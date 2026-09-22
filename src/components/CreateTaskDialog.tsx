import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTaskPermissions } from '@/hooks/useTaskPermissions';
import { Priority, Sector, SECTOR_LABELS } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ImagePlus, X, Package, ScanText, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

import { db } from '@/lib/firebase';
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { uploadImage } from '@/lib/uploadImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { transcribeImageApi } from '@/lib/api';

interface CreateTaskDialogProps {
  preselectedAssignee?: string;
}

const CreateTaskDialog = ({ preselectedAssignee }: CreateTaskDialogProps) => {
  const { currentUser, users, sectorAssignEnabled, nfToCarolEnabled, nfBoletoToCarolEnabled } =
    useApp();
  const { permissions, loading: permissionsLoading } = useTaskPermissions();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assigneeId, setAssigneeId] = useState(preselectedAssignee || '');
  const [deadline, setDeadline] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [assignMode, setAssignMode] = useState<'employee' | 'sector'>(
    preselectedAssignee ? 'employee' : 'employee'
  );
  const [sector, setSector] = useState<Sector | ''>('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentProofFiles, setPaymentProofFiles] = useState<File[]>([]);
  const [paymentProofPreviews, setPaymentProofPreviews] = useState<string[]>([]);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  // Order picking (separação de pedido) states
  const [isSeparacao, setIsSeparacao] = useState(false);
  const [isTroca, setIsTroca] = useState<'sim' | 'nao' | ''>('');
  const [pagamento, setPagamento] = useState<'pago' | 'nao_pago' | ''>('');
  const [usarCreditos, setUsarCreditos] = useState(false);
  const [boleto, setBoleto] = useState<'com' | 'sem' | ''>('');
  const [maquininha, setMaquininha] = useState<'sim' | 'nao' | ''>('');
  const [emissaoNF, setEmissaoNF] = useState<'sim' | 'nao' | ''>('');
  const [formaEntrega, setFormaEntrega] = useState<
    'motoboy' | 'correios' | 'transportadora' | 'balcao' | ''
  >('');
  const [modalidadeCorreios, setModalidadeCorreios] = useState<'sedex' | 'pac' | ''>('');
  const [transportadora, setTransportadora] = useState<string>(''); // carrier name, '' or 'outros'
  const [transportadoraOutros, setTransportadoraOutros] = useState('');
  const [enderecoDiferente, setEnderecoDiferente] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; name: string; blocked: boolean }[]>([]);

  useEffect(() => {
    const carriersQuery = query(collection(db, 'carriers'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      carriersQuery,
      (snapshot) => {
        setCarriers(
          snapshot.docs.map((carrierDoc) => {
            const data = carrierDoc.data();
            return {
              id: carrierDoc.id,
              name: data.name || '',
              blocked: data.blocked === true,
            };
          })
        );
      },
      (error) => {
        console.error('Erro ao carregar transportadoras:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const activeCarriers = useMemo(() => carriers.filter((c) => !c.blocked), [carriers]);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const userPermissions = currentUser
    ? permissions.filter((p) => p.granterId === currentUser.id)
    : [];
  const allowedEmployeeIds = userPermissions
    .filter((p) => p.targetType === 'employee')
    .map((p) => p.targetValue);
  const allowedSectors = userPermissions
    .filter((p) => p.targetType === 'sector')
    .map((p) => p.targetValue);

  const assignableUsers = isAdmin
    ? users.filter((u) => u.role === 'employee' || u.role === 'admin')
    : users.filter((u) => allowedEmployeeIds.includes(u.id));

  const assignableSectors = isAdmin
    ? (Object.keys(SECTOR_LABELS) as Sector[])
    : (Object.keys(SECTOR_LABELS) as Sector[]).filter((s) => allowedSectors.includes(s));

  const hasEmployeePerms = isAdmin || allowedEmployeeIds.length > 0;
  const hasSectorPerms = sectorAssignEnabled && (isAdmin || allowedSectors.length > 0);
  const hasAnyPerms = hasEmployeePerms || hasSectorPerms;

  const effectiveAssignMode = preselectedAssignee
    ? 'employee'
    : hasEmployeePerms && hasSectorPerms
      ? assignMode
      : hasSectorPerms
        ? 'sector'
        : 'employee';

  // Determine if target is expedição
  const isTargetingExpedicao = useMemo(() => {
    if (effectiveAssignMode === 'sector' && sector === 'expedicao') return true;
    if (effectiveAssignMode === 'employee' && assigneeId) {
      const assignee = users.find((u) => u.id === assigneeId);
      if (assignee?.sectors?.includes('expedicao' as Sector)) return true;
    }
    return false;
  }, [effectiveAssignMode, sector, assigneeId, users]);

  // Reset separação fields when not targeting expedição
  const resetSeparacaoFields = () => {
    setIsSeparacao(false);
    setIsTroca('');
    setPagamento('');
    setUsarCreditos(false);
    setBoleto('');
    setMaquininha('');
    setEmissaoNF('');
    setFormaEntrega('');
    setModalidadeCorreios('');
    setTransportadora('');
    setTransportadoraOutros('');
    setEnderecoDiferente(false);
    setOcrImage(null);
    setPaymentProofFiles([]);
    setPaymentProofPreviews([]);
  };

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setImageFiles((prev) => {
      if (prev.length >= 10) {
        toast.error('Máximo de 10 imagens por tarefa');
        return prev;
      }

      return [...prev, file];
    });

    const reader = new FileReader();
    reader.onload = (e) =>
      setImagePreviews((prev) => {
        if (prev.length >= 10) return prev;
        return [...prev, e.target?.result as string];
      });
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleImageSelect(file);
          break;
        }
      }
    },
    [handleImageSelect]
  );

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProofSelect = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) {
      toast.error('Apenas imagens ou PDF são permitidos');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo deve ter no máximo 10MB');
      return;
    }
    setPaymentProofFiles((prev) => [...prev, file]);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) =>
        setPaymentProofPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    } else {
      setPaymentProofPreviews((prev) => [...prev, '__pdf__']);
    }
  };

  const handleProofPaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleProofSelect(file);
        break;
      }
    }
  }, []);

  const removeProof = (index: number) => {
    setPaymentProofFiles((prev) => prev.filter((_, i) => i !== index));
    setPaymentProofPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFilesList = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      try {
        const { publicUrl } = await uploadImage(file, {
          pathPrefix: 'tasks',
          sourceTable: 'tasks',
          sourceField: 'image_urls',
          uploadedBy: currentUser?.id,
        });
        urls.push(publicUrl);
      } catch (err) {
        console.error('Upload error:', err);
        toast.error('Erro ao enviar arquivo');
      }
    }
    return urls;
  };

  const uploadImages = async (): Promise<string[]> => uploadFilesList(imageFiles);
  const uploadPaymentProofs = async (): Promise<string[]> => uploadFilesList(paymentProofFiles);

  const handleOcrPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        e.stopPropagation();
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          setOcrImage(base64);
          setOcrLoading(true);
          try {
            const resp = await transcribeImageApi({ imageBase64: base64 });
            const transcribed = resp.text || '';
            setDescription((prev) => (prev ? `${prev}\n\n${transcribed}` : transcribed));
            toast.success('Texto transcrito com sucesso!');
          } catch (err) {
            console.error('OCR error:', err);
            toast.error('Erro ao transcrever imagem');
          } finally {
            setOcrLoading(false);
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const ENDERECO_BANNER =
    '🚨🚨🚨 ENDEREÇO DE ENVIO DIFERENTE DO CADASTRO 🚨🚨🚨\n=========================================\n⚠️ ATENÇÃO: CONFERIR ENDEREÇO DE ENVIO ⚠️\n=========================================';

  const buildSeparacaoDescription = () => {
    if (!isSeparacao) return description;
    const parts: string[] = [];
    if (enderecoDiferente) parts.push(ENDERECO_BANNER);
    parts.push(description);
    parts.push('\n📦 SEPARAÇÃO DE PEDIDO');
    if (enderecoDiferente) parts.push('🚨 ENDEREÇO DE ENVIO DIFERENTE DO CADASTRO');
    if (isTroca) parts.push(`🔄 ${isTroca === 'sim' ? 'TROCA' : 'NÃO É TROCA'}`);
    if (pagamento) parts.push(`💰 ${pagamento === 'pago' ? 'Pago' : 'Não Pago'}`);
    if (pagamento === 'pago' && usarCreditos) parts.push('🪙 USAR CRÉDITOS');
    if (boleto) parts.push(`📄 ${boleto === 'com' ? 'COM Boleto' : 'SEM Boleto'}`);
    if (emissaoNF)
      parts.push(`🧾 ${emissaoNF === 'sim' ? 'COM Emissão de NF' : 'SEM Emissão de NF'}`);
    if (maquininha)
      parts.push(`💳 ${maquininha === 'sim' ? 'Levar Maquininha' : 'Sem Maquininha'}`);
    if (formaEntrega) {
      const labels: Record<string, string> = {
        motoboy: '🏍️ Motoboy',
        correios: '📮 Correios',
        transportadora: '🚛 Transportadora',
        balcao: '🏪 Balcão',
      };
      parts.push(`🚚 Entrega: ${labels[formaEntrega] || formaEntrega}`);
    }
    if (modalidadeCorreios) {
      parts.push(`📬 Modalidade: ${modalidadeCorreios === 'sedex' ? 'SEDEX' : 'PAC'}`);
    }
    if (formaEntrega === 'transportadora' && transportadora) {
      const transpLabel =
        transportadora === 'outros' ? transportadoraOutros || 'Outros' : transportadora;
      parts.push(`🚛 Transportadora: ${transpLabel}`);
    }
    return parts.filter(Boolean).join('\n');
  };

  const buildOrderInfoNotes = () => {
    // Structured notes for parsing in motoboy/corridas views
    const tags: string[] = [];
    if (enderecoDiferente) tags.push('ENDERECO_DIFERENTE');
    if (isTroca === 'sim') tags.push('TROCA');
    if (isTroca === 'nao') tags.push('NAO_TROCA');
    if (pagamento === 'pago') tags.push('PAGO');
    if (pagamento === 'pago' && usarCreditos) tags.push('USAR_CREDITOS');
    if (pagamento === 'nao_pago') tags.push('NAO_PAGO');
    if (maquininha === 'sim') tags.push('MAQUININHA');
    if (maquininha === 'nao') tags.push('SEM_MAQUININHA');
    if (emissaoNF === 'sim') tags.push('NF');
    if (emissaoNF === 'nao') tags.push('SEM_NF');
    if (boleto === 'com') tags.push('BOLETO');
    if (boleto === 'sem') tags.push('SEM_BOLETO');
    return tags.length ? `[INFO:${tags.join(',')}]` : '';
  };

  const handleSubmit = async () => {
    if (!title || !currentUser) return;
    if (effectiveAssignMode === 'employee' && !assigneeId) return;
    if (effectiveAssignMode === 'sector' && !sector) return;

    // Require payment proof when separação de pedido marked as PAGO,
    // exceto quando o cliente for usar créditos (comprovante é opcional)
    if (isSeparacao && pagamento === 'pago' && !usarCreditos && paymentProofFiles.length === 0) {
      toast.error('Anexe o comprovante de pagamento (imagem ou PDF)');
      return;
    }

    setUploading(true);
    const uploadedUrls = await uploadImages();
    const proofUrls = await uploadPaymentProofs();
    const allImageUrls = [...uploadedUrls, ...proofUrls];
    const firstImageUrl = allImageUrls.length > 0 ? allImageUrls[0] : undefined;

    const fullDeadline = deadline && taskTime ? `${deadline} ${taskTime}` : deadline || '';
    let finalDescription = buildSeparacaoDescription();
    if (proofUrls.length > 0) {
      finalDescription += `\n\n💳 Comprovante(s) de Pagamento:\n${proofUrls.map((u) => `• ${u}`).join('\n')}`;
    }

    // Cria a tarefa principal no Firestore.
    const now = new Date().toISOString();
    const statusHistory = [{ status: 'todo', enteredAt: now }];

    let insertedTaskId: string;

    try {
      const insertedTask = await addDoc(collection(db, 'tasks'), {
        title: isSeparacao && enderecoDiferente ? `🚨 ENDEREÇO DIFERENTE - ${title}` : title,
        description: finalDescription,
        priority,
        assignee_id: effectiveAssignMode === 'employee' ? assigneeId : '',
        deadline: fullDeadline,
        status: 'todo',
        created_by: currentUser.id,
        sector: effectiveAssignMode === 'sector' ? (sector as Sector) : null,
        image_url: firstImageUrl || null,
        image_urls: allImageUrls,
        status_history: statusHistory,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      insertedTaskId = insertedTask.id;
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Erro ao criar tarefa');
      setUploading(false);
      return;
    }

    // Send notification for assigned user
    if (effectiveAssignMode === 'employee' && assigneeId) {
      await addDoc(collection(db, 'notifications'), {
        user_id: assigneeId,
        message: `Nova tarefa atribuída: ${title}`,
        type: 'task_created',
        read: false,
        created_at: Timestamp.now(),
      });
    }

    // If separação with motoboy delivery, create a ride pending Patricia's approval
    if (isSeparacao && formaEntrega === 'motoboy' && currentUser) {
      const separacaoDetails = [
        pagamento === 'pago' ? '💰 Pago' : pagamento === 'nao_pago' ? '💰 Não Pago' : '',
        boleto === 'com' ? '📄 COM Boleto' : boleto === 'sem' ? '📄 SEM Boleto' : '',
        emissaoNF === 'sim' ? '🧾 COM NF' : emissaoNF === 'nao' ? '🧾 SEM NF' : '',
        maquininha === 'sim'
          ? '💳 Levar Maquininha'
          : maquininha === 'nao'
            ? '💳 Sem Maquininha'
            : '',
      ]
        .filter(Boolean)
        .join(' | ');
      const infoTag = buildOrderInfoNotes();
      const fullNotes = [separacaoDetails, infoTag].filter(Boolean).join(' ');
      await addDoc(collection(db, 'motoboy_assignments'), {
        description: enderecoDiferente
          ? `🚨 ENDEREÇO DIFERENTE - Entrega: ${title}`
          : `Entrega: ${title}`,
        assigned_to: 'pending',
        assigned_by: currentUser.id,
        ride_value: 15,
        client_name: '',
        location: '',
        notes: fullNotes,
        status: 'pending_approval',
        task_id: null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      toast.info('Corrida criada aguardando aprovação de Patrícia');
    }

    // If separação with Transportadora, create a personal task for Patricia (emp-1)
    if (isSeparacao && formaEntrega === 'transportadora' && currentUser) {
      const transpLabel =
        transportadora === 'outros'
          ? transportadoraOutros?.trim() || 'Outros'
          : transportadora || 'Outros';
      const patriciaTaskDesc = [
        enderecoDiferente ? ENDERECO_BANNER : '',
        `Transportadora: ${transpLabel}`,
        `Pedido: ${title}`,
        pagamento === 'pago' ? '💰 Pago' : pagamento === 'nao_pago' ? '💰 Não Pago' : '',
        boleto === 'com' ? '📄 COM Boleto' : boleto === 'sem' ? '📄 SEM Boleto' : '',
        emissaoNF === 'sim' ? '🧾 COM NF' : emissaoNF === 'nao' ? '🧾 SEM NF' : '',
        maquininha === 'sim'
          ? '💳 Levar Maquininha'
          : maquininha === 'nao'
            ? '💳 Sem Maquininha'
            : '',
        description ? `Obs: ${description}` : '',
        enderecoDiferente ? '[INFO:ENDERECO_DIFERENTE]' : '',
      ]
        .filter(Boolean)
        .join('\n');
      const deadlinePatricia = new Date();
      deadlinePatricia.setHours(23, 59, 59, 999);
      const patStatusHistory = [{ status: 'todo', enteredAt: new Date().toISOString() }];
      await addDoc(collection(db, 'tasks'), {
        title: `${enderecoDiferente ? '🚨 ENDEREÇO DIFERENTE - ' : ''}🚛 Transportadora ${transpLabel}: ${title}`,
        description: patriciaTaskDesc,
        status: 'todo',
        priority: 'medium',
        assignee_id: 'emp-1',
        created_by: currentUser.id,
        deadline: deadlinePatricia.toISOString().split('T')[0],
        sector: null,
        status_history: patStatusHistory,
        image_url: firstImageUrl || null,
        image_urls: uploadedUrls,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      await addDoc(collection(db, 'notifications'), {
        user_id: 'emp-1',
        message: `Transportadora ${transpLabel}: ${title}`,
        type: 'task_created',
        read: false,
        created_at: Timestamp.now(),
      });
      toast.info(`Tarefa de transportadora ${transpLabel} criada para Patrícia`);
    }

    // If separação with Balcão OR Transportadora "PH Transportes", create a pickup entry
    if (isSeparacao && currentUser) {
      const isBalcao = formaEntrega === 'balcao';
      const transpLabelPickup =
        transportadora === 'outros' ? transportadoraOutros?.trim() || '' : transportadora || '';
      const isPH =
        formaEntrega === 'transportadora' &&
        transpLabelPickup.toLowerCase().includes('ph transportes');
      if (isBalcao || isPH) {
        const pickupDetails = [
          enderecoDiferente ? ENDERECO_BANNER : '',
          pagamento === 'pago' ? '💰 Pago' : pagamento === 'nao_pago' ? '💰 Não Pago' : '',
          boleto === 'com' ? '📄 COM Boleto' : boleto === 'sem' ? '📄 SEM Boleto' : '',
          emissaoNF === 'sim' ? '🧾 COM NF' : emissaoNF === 'nao' ? '🧾 SEM NF' : '',
          maquininha === 'sim'
            ? '💳 Levar Maquininha'
            : maquininha === 'nao'
              ? '💳 Sem Maquininha'
              : '',
          description ? `Obs: ${description}` : '',
          enderecoDiferente ? '[INFO:ENDERECO_DIFERENTE]' : '',
        ]
          .filter(Boolean)
          .join('\n');
        await addDoc(collection(db, 'pickups'), {
          order_title: title,
          delivery_type: isBalcao ? 'balcao' : 'transportadora',
          carrier_name: isBalcao ? null : transpLabelPickup,
          details: pickupDetails || null,
          task_id: insertedTaskId,
          created_by: currentUser.id,
          status: 'pending',
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });
        toast.info(
          isBalcao ? 'Retirada de Balcão registrada' : 'Retirada PH Transportes registrada'
        );
      }
    }

    // If separação with Correios delivery, create a task for William to generate shipping label
    if (isSeparacao && formaEntrega === 'correios' && modalidadeCorreios && currentUser) {
      const modalLabel = modalidadeCorreios === 'sedex' ? 'SEDEX' : 'PAC';
      const williamTaskDesc = [
        enderecoDiferente ? ENDERECO_BANNER : '',
        `Gerar etiqueta de envio via ${modalLabel}`,
        `Pedido: ${title}`,
        pagamento === 'pago' ? '💰 Pago' : pagamento === 'nao_pago' ? '💰 Não Pago' : '',
        emissaoNF === 'sim'
          ? '🧾 COM Emissão de NF'
          : emissaoNF === 'nao'
            ? '🧾 SEM Emissão de NF'
            : '',
        boleto === 'com' ? '📄 COM Boleto' : boleto === 'sem' ? '📄 SEM Boleto' : '',
        description ? `Obs: ${description}` : '',
        `[INFO:${[
          enderecoDiferente ? 'ENDERECO_DIFERENTE' : '',
          pagamento === 'pago' ? 'PAGO' : pagamento === 'nao_pago' ? 'NAO_PAGO' : '',
          emissaoNF === 'sim' ? 'NF' : emissaoNF === 'nao' ? 'SEM_NF' : '',
          boleto === 'com' ? 'BOLETO' : boleto === 'sem' ? 'SEM_BOLETO' : '',
        ]
          .filter(Boolean)
          .join(',')}]`,
      ]
        .filter(Boolean)
        .join('\n');
      const deadlineForWilliam = new Date();
      deadlineForWilliam.setHours(23, 59, 59, 999);
      const statusHistory = [{ status: 'todo', enteredAt: new Date().toISOString() }];
      await addDoc(collection(db, 'tasks'), {
        title: `${enderecoDiferente ? '🚨 ENDEREÇO DIFERENTE - ' : ''}📮 Etiqueta ${modalLabel}: ${title}`,
        description: williamTaskDesc,
        status: 'todo',
        priority: 'high',
        assignee_id: 'emp-12',
        created_by: currentUser.id,
        deadline: deadlineForWilliam.toISOString().split('T')[0],
        sector: 'expedicao',
        status_history: statusHistory,
        image_url: firstImageUrl || null,
        image_urls: uploadedUrls,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      toast.info(`Tarefa de etiqueta ${modalLabel} criada para William`);
    }

    // If separação with NF, COM Boleto, or TROCA, create task for financial sector
    if (
      isSeparacao &&
      (emissaoNF === 'sim' || boleto === 'com' || isTroca === 'sim') &&
      currentUser
    ) {
      const financialParts: string[] = [];
      if (emissaoNF === 'sim') financialParts.push('🧾 Emissão de NF');
      if (boleto === 'com') financialParts.push('📄 Gerar Boleto');
      const trocaBanner =
        isTroca === 'sim'
          ? '🔄🔄🔄 TROCA 🔄🔄🔄\n=========================\n⚠️ ATENÇÃO: ESTE PEDIDO É UMA TROCA ⚠️\n=========================\n'
          : '';
      const financialTaskDesc = [
        enderecoDiferente ? ENDERECO_BANNER : '',
        trocaBanner,
        financialParts.join(' + '),
        `Pedido: ${title}`,
        pagamento === 'pago' ? '💰 Pago' : pagamento === 'nao_pago' ? '💰 Não Pago' : '',
        description ? `Obs: ${description}` : '',
        enderecoDiferente ? '[INFO:ENDERECO_DIFERENTE]' : '',
      ]
        .filter(Boolean)
        .join('\n');
      const deadlineFinanceiro = new Date();
      deadlineFinanceiro.setHours(23, 59, 59, 999);
      const finStatusHistory = [{ status: 'todo', enteredAt: new Date().toISOString() }];

      const trocaPrefix = isTroca === 'sim' ? '🔄 TROCA - ' : '';
      const hasNF = emissaoNF === 'sim';
      const hasBoleto = boleto === 'com';
      const nfWithBoleto = hasNF && hasBoleto;
      const nfOnly = hasNF && !hasBoleto;
      const boletoOnly = hasBoleto && !hasNF;
      const trocaOnly = !hasNF && !hasBoleto && isTroca === 'sim';

      // Routing: NF+Boleto → Carol (emp-15) if toggle, else Patrícia (emp-1).
      // NF only → Carol if toggle, else Patrícia (emp-1).
      // Boleto only → Financeiro setor (sem alteração).
      // TROCA only → Financeiro setor.
      let targetAssignee: string = '';
      let targetSector: string | null = 'financeiro';
      let targetName = 'Financeiro';
      if (nfWithBoleto) {
        if (nfBoletoToCarolEnabled) {
          targetAssignee = 'emp-11';
          targetSector = null;
          targetName = 'Carol';
        } else {
          targetAssignee = 'emp-1';
          targetSector = null;
          targetName = 'Patrícia';
        }
      } else if (nfOnly) {
        if (nfToCarolEnabled) {
          targetAssignee = 'emp-11';
          targetSector = null;
          targetName = 'Carol';
        } else {
          targetAssignee = 'emp-1';
          targetSector = null;
          targetName = 'Patrícia';
        }
      }

      const enderecoPrefix = enderecoDiferente ? '🚨 ENDEREÇO DIFERENTE - ' : '';
      const finTitle = nfWithBoleto
        ? `${enderecoPrefix}${trocaPrefix}🧾 NF + Boleto: ${title}`
        : nfOnly
          ? `${enderecoPrefix}${trocaPrefix}🧾 Emissão NF: ${title}`
          : boletoOnly
            ? `${enderecoPrefix}${trocaPrefix}📄 Boleto: ${title}`
            : `${enderecoPrefix}🔄 TROCA: ${title}`;
      await addDoc(collection(db, 'tasks'), {
        title: finTitle,
        description: financialTaskDesc,
        status: 'todo',
        priority: 'high',
        assignee_id: targetAssignee,
        created_by: currentUser.id,
        deadline: deadlineFinanceiro.toISOString().split('T')[0],
        sector: targetSector,
        status_history: finStatusHistory,
        image_url: firstImageUrl || null,
        image_urls: uploadedUrls,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      if (targetAssignee) {
        await addDoc(collection(db, 'notifications'), {
          user_id: targetAssignee,
          message: `${finTitle}`,
          type: 'task_created',
          read: false,
          created_at: Timestamp.now(),
        });
      }
      const labelParts = financialParts.length > 0 ? financialParts.join(' e ') : 'TROCA';
      toast.info(
        `Tarefa de ${labelParts} criada para ${targetName}${isTroca === 'sim' && !trocaOnly ? ' (TROCA)' : ''}`
      );
    }

    // If separação marked as PAGO (com comprovante OU usando créditos), create "Dar Baixa no Caixa" task for Financeiro
    if (
      isSeparacao &&
      pagamento === 'pago' &&
      (proofUrls.length > 0 || usarCreditos) &&
      currentUser
    ) {
      const combinedImageUrls = [...proofUrls, ...uploadedUrls];
      const baixaTitlePrefix = usarCreditos
        ? '💰🪙 Dar Baixa no Caixa (USAR CRÉDITOS)'
        : '💰 Dar Baixa no Caixa';
      const baixaDesc = [
        enderecoDiferente ? ENDERECO_BANNER : '',
        usarCreditos ? '🪙 USAR CRÉDITOS DO CLIENTE' : '💰 DAR BAIXA NO CAIXA',
        `Pedido: ${title}`,
        usarCreditos
          ? proofUrls.length > 0
            ? 'Cliente irá utilizar créditos. Comprovante anexado (opcional).'
            : 'Cliente irá utilizar créditos — comprovante NÃO foi anexado (opcional neste caso).'
          : 'Pagamento confirmado — comprovante anexo.',
        proofUrls.length > 0
          ? `\n💳 Comprovante(s):\n${proofUrls.map((u) => `• ${u}`).join('\n')}`
          : '',
        uploadedUrls.length > 0
          ? `\n📋 Pedido de Separação (imagem):\n${uploadedUrls.map((u) => `• ${u}`).join('\n')}`
          : '',
        description ? `\nObs: ${description}` : '',
        enderecoDiferente ? '[INFO:ENDERECO_DIFERENTE]' : '',
      ]
        .filter(Boolean)
        .join('\n');
      const deadlineBaixa = new Date();
      deadlineBaixa.setHours(23, 59, 59, 999);
      const baixaHistory = [{ status: 'todo', enteredAt: new Date().toISOString() }];
      await addDoc(collection(db, 'tasks'), {
        title: `${enderecoDiferente ? '🚨 ENDEREÇO DIFERENTE - ' : ''}${baixaTitlePrefix}: ${title}`,
        description: baixaDesc,
        status: 'todo',
        priority: 'high',
        assignee_id: '',
        created_by: currentUser.id,
        deadline: deadlineBaixa.toISOString().split('T')[0],
        sector: 'financeiro',
        status_history: baixaHistory,
        image_url: proofUrls[0] || firstImageUrl || null,
        image_urls: combinedImageUrls,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      toast.info(
        usarCreditos
          ? 'Tarefa de Baixa no Caixa (USAR CRÉDITOS) criada para o Financeiro'
          : 'Tarefa de Baixa no Caixa criada para o Financeiro'
      );
    }

    // Reset all fields
    setTitle('');
    setDescription('');
    setPriority('medium');
    setAssigneeId(preselectedAssignee || '');
    setDeadline('');
    setTaskTime('');
    setSector('');
    setAssignMode(
      preselectedAssignee ? 'employee' : hasSectorPerms && !hasEmployeePerms ? 'sector' : 'employee'
    );
    setImageFiles([]);
    setImagePreviews([]);
    resetSeparacaoFields();
    setUploading(false);
    setOpen(false);
  };

  const isValid =
    title &&
    ((effectiveAssignMode === 'employee' && assigneeId) ||
      (effectiveAssignMode === 'sector' && sector));

  if (permissionsLoading) return null;
  if (!isAdmin && !hasAnyPerms && !preselectedAssignee) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetSeparacaoFields();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2" onPaste={handlePaste}>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome da tarefa"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a tarefa..."
              rows={3}
            />
          </div>

          {/* Image upload - multiple */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Imagens (até 10, opcional)</label>
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative inline-block">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border border-border"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imageFiles.length < 10 && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                  {imageFiles.length > 0
                    ? `Adicionar Mais (${imageFiles.length}/10)`
                    : 'Adicionar Imagem'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">Ou cole uma imagem (Ctrl+V)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      Array.from(e.target.files).forEach((f) => handleImageSelect(f));
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Média</SelectItem>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Prazo (opcional)</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Horário (opcional)</label>
            <Input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
          </div>
          {!preselectedAssignee && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Atribuir a</label>
              {hasEmployeePerms && hasSectorPerms ? (
                <Tabs
                  value={assignMode}
                  onValueChange={(v) => {
                    setAssignMode(v as 'employee' | 'sector');
                    resetSeparacaoFields();
                  }}
                >
                  <TabsList className="w-full mb-2">
                    <TabsTrigger value="employee" className="flex-1">
                      Funcionário
                    </TabsTrigger>
                    <TabsTrigger value="sector" className="flex-1">
                      Setor
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="employee">
                    <Select
                      value={assigneeId}
                      onValueChange={(v) => {
                        setAssigneeId(v);
                        resetSeparacaoFields();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funcionário" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableUsers.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                  <TabsContent value="sector">
                    <Select
                      value={sector}
                      onValueChange={(v) => {
                        setSector(v as Sector);
                        resetSeparacaoFields();
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableSectors.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SECTOR_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Qualquer funcionário do setor poderá resgatar esta tarefa.
                    </p>
                  </TabsContent>
                </Tabs>
              ) : hasEmployeePerms ? (
                <Select
                  value={assigneeId}
                  onValueChange={(v) => {
                    setAssigneeId(v);
                    resetSeparacaoFields();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Select
                    value={sector}
                    onValueChange={(v) => {
                      setSector(v as Sector);
                      resetSeparacaoFields();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableSectors.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SECTOR_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Qualquer funcionário do setor poderá resgatar esta tarefa.
                  </p>
                </>
              )}
            </div>
          )}
          {preselectedAssignee && <input type="hidden" value={assigneeId} />}

          {/* Separação de Pedido - only for expedição */}
          {isTargetingExpedicao && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <label className="text-sm font-medium">Separação de Pedido</label>
                </div>
                <Switch
                  checked={isSeparacao}
                  onCheckedChange={(v) => {
                    setIsSeparacao(v);
                    if (!v) {
                      setIsTroca('');
                      setPagamento('');
                      setBoleto('');
                      setMaquininha('');
                      setEmissaoNF('');
                      setFormaEntrega('');
                    }
                  }}
                />
              </div>

              {isSeparacao && (
                <div className="space-y-2 pt-1">
                  {/* Endereço diferente do cadastro */}
                  <div
                    className={cn(
                      'flex items-center justify-between rounded-md border-2 px-3 py-2 transition-colors',
                      enderecoDiferente
                        ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/40'
                        : 'border-border'
                    )}
                  >
                    <div className="flex flex-col pr-2">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          enderecoDiferente ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                        )}
                      >
                        🚨 Endereço de envio diferente do cadastro
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Quando ativado, as tarefas geradas ficam destacadas em vermelho.
                      </span>
                    </div>
                    <Switch checked={enderecoDiferente} onCheckedChange={setEnderecoDiferente} />
                  </div>

                  {/* Troca */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-foreground">Caso de Troca?</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={isTroca === 'sim' ? 'default' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setIsTroca(isTroca === 'sim' ? '' : 'sim')}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={isTroca === 'nao' ? 'secondary' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setIsTroca(isTroca === 'nao' ? '' : 'nao')}
                      >
                        Não
                      </Button>
                    </div>
                  </div>

                  {/* Pagamento */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-foreground">Pagamento</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={pagamento === 'pago' ? 'default' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setPagamento(pagamento === 'pago' ? '' : 'pago')}
                      >
                        Pago
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={pagamento === 'nao_pago' ? 'destructive' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setPagamento(pagamento === 'nao_pago' ? '' : 'nao_pago')}
                      >
                        Não Pago
                      </Button>
                    </div>
                  </div>

                  {/* Usar Créditos - aparece quando PAGO */}
                  {pagamento === 'pago' && (
                    <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          🪙 Usar Créditos
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Cliente irá abater com créditos. Comprovante torna-se opcional.
                        </span>
                      </div>
                      <Switch
                        checked={usarCreditos}
                        onCheckedChange={(v) => setUsarCreditos(!!v)}
                      />
                    </div>
                  )}

                  {/* Comprovante de Pagamento - obrigatório quando PAGO, opcional se Usar Créditos */}
                  {pagamento === 'pago' && (
                    <div
                      className={`rounded-md border px-3 py-2 space-y-2 ${
                        usarCreditos
                          ? 'border-border bg-muted/20'
                          : 'border-warning/40 bg-warning/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">
                          💳 Comprovante de Pagamento{' '}
                          {usarCreditos ? (
                            <span className="text-muted-foreground font-normal">(opcional)</span>
                          ) : (
                            <span className="text-destructive">*</span>
                          )}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={() => paymentProofInputRef.current?.click()}
                          >
                            <ImagePlus className="w-3 h-3 mr-1" /> Anexar
                          </Button>
                        </div>
                        <input
                          ref={paymentProofInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            files.forEach(handleProofSelect);
                            if (paymentProofInputRef.current)
                              paymentProofInputRef.current.value = '';
                          }}
                        />
                      </div>
                      <Textarea
                        placeholder="Cole aqui (Ctrl+V) uma imagem do comprovante ou clique em Anexar para enviar imagem/PDF"
                        className="min-h-[44px] text-xs resize-none"
                        readOnly
                        onPaste={handleProofPaste}
                      />
                      {paymentProofPreviews.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {paymentProofPreviews.map((src, i) => (
                            <div
                              key={i}
                              className="relative w-16 h-16 rounded border border-border overflow-hidden bg-muted flex items-center justify-center"
                            >
                              {src === '__pdf__' ? (
                                <span className="text-[10px] text-muted-foreground px-1 text-center">
                                  📄 {paymentProofFiles[i]?.name.slice(0, 12) || 'PDF'}
                                </span>
                              ) : (
                                <img
                                  src={src}
                                  alt={`comprovante ${i + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => removeProof(i)}
                                className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl px-1 text-[10px] leading-none"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Boleto */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-foreground">Boleto</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={boleto === 'com' ? 'default' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setBoleto(boleto === 'com' ? '' : 'com')}
                      >
                        Com Boleto
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={boleto === 'sem' ? 'secondary' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setBoleto(boleto === 'sem' ? '' : 'sem')}
                      >
                        Sem Boleto
                      </Button>
                    </div>
                  </div>

                  {/* Emissão de NF (opcional) */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-foreground">🧾 Emissão de NF</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={emissaoNF === 'sim' ? 'default' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setEmissaoNF(emissaoNF === 'sim' ? '' : 'sim')}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={emissaoNF === 'nao' ? 'secondary' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setEmissaoNF(emissaoNF === 'nao' ? '' : 'nao')}
                      >
                        Não
                      </Button>
                    </div>
                  </div>

                  {/* Maquininha */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm text-foreground">Maquininha</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={maquininha === 'sim' ? 'default' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setMaquininha(maquininha === 'sim' ? '' : 'sim')}
                      >
                        Levar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={maquininha === 'nao' ? 'secondary' : 'outline'}
                        className="h-7 text-xs px-3"
                        onClick={() => setMaquininha(maquininha === 'nao' ? '' : 'nao')}
                      >
                        Não Levar
                      </Button>
                    </div>
                  </div>

                  {/* Forma de Entrega */}
                  <div className="rounded-md border border-border px-3 py-2 space-y-2">
                    <span className="text-sm text-foreground">Forma de Entrega</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={formaEntrega === 'motoboy' ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => {
                          setFormaEntrega(formaEntrega === 'motoboy' ? '' : 'motoboy');
                          setModalidadeCorreios('');
                        }}
                      >
                        🏍️ Motoboy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={formaEntrega === 'correios' ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => {
                          setFormaEntrega(formaEntrega === 'correios' ? '' : 'correios');
                          if (formaEntrega === 'correios') setModalidadeCorreios('');
                        }}
                      >
                        📮 Correios
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={formaEntrega === 'transportadora' ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => {
                          const next = formaEntrega === 'transportadora' ? '' : 'transportadora';
                          setFormaEntrega(next);
                          setModalidadeCorreios('');
                          if (next !== 'transportadora') {
                            setTransportadora('');
                            setTransportadoraOutros('');
                          }
                        }}
                      >
                        🚛 Transportadora
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={formaEntrega === 'balcao' ? 'default' : 'outline'}
                        className="h-8 text-xs"
                        onClick={() => {
                          setFormaEntrega(formaEntrega === 'balcao' ? '' : 'balcao');
                          setModalidadeCorreios('');
                        }}
                      >
                        🏪 Balcão
                      </Button>
                    </div>
                    {formaEntrega === 'motoboy' && (
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Corrida será enviada para Patrícia aprovar.
                      </p>
                    )}
                    {formaEntrega === 'correios' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <span className="text-sm text-foreground">Modalidade</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant={modalidadeCorreios === 'sedex' ? 'default' : 'outline'}
                              className="h-7 text-xs px-3"
                              onClick={() =>
                                setModalidadeCorreios(modalidadeCorreios === 'sedex' ? '' : 'sedex')
                              }
                            >
                              SEDEX
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={modalidadeCorreios === 'pac' ? 'default' : 'outline'}
                              className="h-7 text-xs px-3"
                              onClick={() =>
                                setModalidadeCorreios(modalidadeCorreios === 'pac' ? '' : 'pac')
                              }
                            >
                              PAC
                            </Button>
                          </div>
                        </div>
                        {modalidadeCorreios && (
                          <p className="text-xs text-muted-foreground">
                            📋 Tarefa de etiqueta será criada para William.
                          </p>
                        )}
                      </div>
                    )}
                    {formaEntrega === 'transportadora' && (
                      <div className="space-y-2 pt-1">
                        <div className="rounded-md border border-border px-3 py-2 space-y-2">
                          <span className="text-sm text-foreground">Transportadora</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {activeCarriers.map((c) => (
                              <Button
                                key={c.id}
                                type="button"
                                size="sm"
                                variant={transportadora === c.name ? 'default' : 'outline'}
                                className="h-8 text-xs"
                                onClick={() => {
                                  setTransportadora(transportadora === c.name ? '' : c.name);
                                  setTransportadoraOutros('');
                                }}
                              >
                                {c.name}
                              </Button>
                            ))}
                            <Button
                              type="button"
                              size="sm"
                              variant={transportadora === 'outros' ? 'default' : 'outline'}
                              className="h-8 text-xs"
                              onClick={() =>
                                setTransportadora(transportadora === 'outros' ? '' : 'outros')
                              }
                            >
                              Outros
                            </Button>
                          </div>
                          {activeCarriers.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Nenhuma transportadora cadastrada. Use "Outros" ou peça a um
                              administrador para cadastrar em Corporativo › Transportadoras.
                            </p>
                          )}
                          {transportadora === 'outros' && (
                            <Input
                              placeholder="Nome da transportadora"
                              value={transportadoraOutros}
                              onChange={(e) => setTransportadoraOutros(e.target.value)}
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                        {transportadora &&
                          (transportadora !== 'outros' || transportadoraOutros.trim()) && (
                            <p className="text-xs text-muted-foreground">
                              📋 Tarefa pessoal será criada para Patrícia.
                            </p>
                          )}
                      </div>
                    )}
                  </div>

                  {/* OCR Image field for Sedex/PAC ou Transportadora selecionada */}
                  {(modalidadeCorreios === 'sedex' ||
                    modalidadeCorreios === 'pac' ||
                    (formaEntrega === 'transportadora' &&
                      transportadora &&
                      (transportadora !== 'outros' || transportadoraOutros.trim()))) && (
                    <div className="rounded-md border border-border px-3 py-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <ScanText className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">
                          Colar imagem para transcrição IA
                        </span>
                      </div>
                      <div
                        className="min-h-[60px] rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        onPaste={handleOcrPaste}
                        tabIndex={0}
                      >
                        {ocrLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Transcrevendo...
                          </div>
                        ) : ocrImage ? (
                          <div className="relative p-2">
                            <img
                              src={ocrImage}
                              alt="OCR"
                              className="max-h-24 rounded border border-border"
                            />
                            <button
                              onClick={() => setOcrImage(null)}
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground py-3">
                            Cole uma imagem aqui (Ctrl+V) para transcrever automaticamente
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button className="w-full" onClick={handleSubmit} disabled={!isValid || uploading}>
            {uploading ? 'Enviando...' : 'Criar Tarefa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
