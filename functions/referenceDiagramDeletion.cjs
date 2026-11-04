'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getApps, initializeApp } = require('firebase-admin/app');

if (!getApps().length) initializeApp();

const validDiagramImagePath = (path) =>
  typeof path === 'string' &&
  /^reference_diagrams\/[A-Za-z0-9_-]{1,180}\/[A-Za-z0-9_-]{1,180}\.(jpg|png|webp)$/.test(path);

const deleteReferenceDiagram = onCall(
  { region: 'southamerica-east1', maxInstances: 5, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Autenticação necessária');
    const id = request.data?.diagramId;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
      throw new HttpsError('invalid-argument', 'Identificador do sistema inválido');
    }

    const db = getFirestore();
    const link = await db.doc(`auth_links/${request.auth.uid}`).get();
    const userId = link.data()?.user_id;
    if (!link.exists || link.data()?.active === false || link.data()?.role !== 'admin' || !userId) {
      throw new HttpsError('permission-denied', 'Somente administradores ativos podem excluir sistemas');
    }
    const user = await db.doc(`users/${userId}`).get();
    if (!user.exists || user.data()?.active === false || user.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Perfil de administrador inativo ou inconsistente');
    }

    const diagramRef = db.doc(`reference_diagrams/${id}`);
    const diagram = await diagramRef.get();
    if (!diagram.exists) throw new HttpsError('not-found', 'Sistema não encontrado');
    const data = diagram.data();
    const imagePath = data?.image_path;
    if (!validDiagramImagePath(imagePath)) {
      throw new HttpsError('failed-precondition', 'Caminho da imagem fora da pasta autorizada');
    }

    // Primeiro excluímos a imagem para não deixar um arquivo órfão se a etapa do Storage falhar.
    // Se o documento falhar, o admin poderá repetir a exclusão do mesmo sistema.
    try {
      await getStorage().bucket().file(imagePath).delete({ ignoreNotFound: true });
    } catch (error) {
      console.error('deleteReferenceDiagram: falha no Storage', { diagramId: id, error });
      throw new HttpsError('unavailable', 'Não foi possível remover a imagem. O cadastro foi preservado.');
    }

    // Evita apagar uma atualização posterior que tenha trocado a imagem durante a operação.
    // O documento pode permanecer sem imagem em casos raros de falha; o painel exibirá o erro.
    try {
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(diagramRef);
        if (!latest.exists) return;
        if (latest.data()?.image_path !== imagePath) {
          throw new HttpsError('aborted', 'O sistema mudou durante a exclusão. Atualize a página.');
        }
        transaction.delete(diagramRef);
        transaction.set(db.collection('reference_diagram_deletion_audit').doc(id), {
          deleted_by: userId,
          original_image_path: imagePath,
          diagram_title: String(data?.title || '').slice(0, 180),
          deleted_at: FieldValue.serverTimestamp(),
        });
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('deleteReferenceDiagram: falha no Firestore', { diagramId: id, error });
      throw new HttpsError('unavailable', 'Imagem removida, mas o cadastro não pôde ser excluído. Repita a operação.');
    }
    return { deleted: true };
  }
);

module.exports = { deleteReferenceDiagram, validDiagramImagePath };
