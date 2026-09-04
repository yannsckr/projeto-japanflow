import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

export interface TrackingEntry {
  id: string;
  trackingCode: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
  clientName: string;
  shippingMethod: string;
}

export interface ReverseShipment {
  id: string;
  description: string;
  trackingCode: string | null;
  status: string;
  requestedBy: string;
  respondedBy: string | null;
  createdAt: string;
  invoiceNumber: string;
  itemName: string;
  itemValue: number;
  saleDate: string | null;
  returnReason: string;
  productImageUrl: string | null;
}

export interface Receipt {
  id: string;
  description: string;
  photoUrl: string | null;
  createdBy: string;
  likedBy: string[];
  createdAt: string;
}

export interface CounterQuote {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  status: string;
  requestedBy: string;
  respondedBy: string | null;
  response: string | null;
  createdAt: string;
  claimedBy: string | null;
}

export interface LowStockItem {
  id: string;
  productName: string;
  description: string;
  photoUrl: string | null;
  status: string;
  reportedBy: string;
  createdAt: string;
}

export interface SupplyRequest {
  id: string;
  itemName: string;
  description: string;
  quantity: number;
  status: string;
  requestedBy: string;
  createdAt: string;
}

export interface MotoboyAssignment {
  id: string;
  description: string;
  assignedTo: string | null;
  assignedBy: string;
  status: string;
  notes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  rideValue: number;
  clientName: string;
  location: string;
  taskId: string | null;
  scheduledFor: string | null;
}

const toIso = (value: any): string | null => {
  if (!value) return null;
  if (value?.toDate) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
};

export const useDepartmental = () => {
  const [tracking, setTracking] = useState<TrackingEntry[]>([]);
  const [reverseShipments, setReverseShipments] = useState<ReverseShipment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [counterQuotes, setCounterQuotes] = useState<CounterQuote[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [motoboyAssignments, setMotoboyAssignments] = useState<MotoboyAssignment[]>([]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const makeQuery = (collectionName: string) =>
      query(
        collection(db, collectionName),
        orderBy('created_at', 'desc'),
        limit(500)
      );

    unsubscribers.push(
      onSnapshot(
        makeQuery('tracking_entries'),
        (snapshot) => {
          setTracking(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                trackingCode: r.tracking_code || '',
                description: r.description || '',
                status: r.status || 'pending',
                createdBy: r.created_by || '',
                createdAt: toIso(r.created_at) || new Date().toISOString(),
                clientName: r.client_name || '',
                shippingMethod: r.shipping_method || '',
              };
            })
          );
        },
        (error) => console.error('Erro em tracking_entries:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('reverse_shipments'),
        (snapshot) => {
          setReverseShipments(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                description: r.description || '',
                trackingCode: r.tracking_code || null,
                status: r.status || 'pending',
                requestedBy: r.requested_by || '',
                respondedBy: r.responded_by || null,
                createdAt: toIso(r.created_at) || new Date().toISOString(),
                invoiceNumber: r.invoice_number || '',
                itemName: r.item_name || '',
                itemValue: Number(r.item_value) || 0,
                saleDate: toIso(r.sale_date) || r.sale_date || null,
                returnReason: r.return_reason || '',
                productImageUrl: r.product_image_url || null,
              };
            })
          );
        },
        (error) => console.error('Erro em reverse_shipments:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('receipts'),
        (snapshot) => {
          setReceipts(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                description: r.description || '',
                photoUrl: r.photo_url || null,
                createdBy: r.created_by || '',
                likedBy: Array.isArray(r.liked_by) ? r.liked_by : [],
                createdAt: toIso(r.created_at) || new Date().toISOString(),
              };
            })
          );
        },
        (error) => console.error('Erro em receipts:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('counter_quotes'),
        (snapshot) => {
          setCounterQuotes(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                productName: r.product_name || '',
                description: r.description || '',
                quantity: Number(r.quantity) || 0,
                status: r.status || 'pending',
                requestedBy: r.requested_by || '',
                respondedBy: r.responded_by || null,
                response: r.response || null,
                createdAt: toIso(r.created_at) || new Date().toISOString(),
                claimedBy: r.claimed_by || null,
              };
            })
          );
        },
        (error) => console.error('Erro em counter_quotes:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('low_stock_items'),
        (snapshot) => {
          setLowStockItems(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                productName: r.product_name || '',
                description: r.description || '',
                photoUrl: r.photo_url || null,
                status: r.status || 'pending',
                reportedBy: r.reported_by || '',
                createdAt: toIso(r.created_at) || new Date().toISOString(),
              };
            })
          );
        },
        (error) => console.error('Erro em low_stock_items:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('supply_requests'),
        (snapshot) => {
          setSupplyRequests(
            snapshot.docs.map((row) => {
              const r = row.data();
              return {
                id: row.id,
                itemName: r.item_name || '',
                description: r.description || '',
                quantity: Number(r.quantity) || 0,
                status: r.status || 'pending',
                requestedBy: r.requested_by || '',
                createdAt: toIso(r.created_at) || new Date().toISOString(),
              };
            })
          );
        },
        (error) => console.error('Erro em supply_requests:', error)
      )
    );

    unsubscribers.push(
      onSnapshot(
        makeQuery('motoboy_assignments'),
        async (snapshot) => {
          const raw = snapshot.docs.map((row) => ({
            id: row.id,
            ...row.data(),
          })) as any[];

          // Mantém a sincronização antiga:
          // se a task vinculada já estiver "done", conclui a corrida automaticamente.
          const pendingWithTaskId = raw.filter(
            (r) => r.task_id && r.status !== 'completed'
          );

          if (pendingWithTaskId.length > 0) {
            await Promise.all(
              pendingWithTaskId.map(async (assignment) => {
                try {
                  const taskSnapshot = await getDoc(
                    doc(db, 'tasks', assignment.task_id)
                  );

                  if (
                    taskSnapshot.exists() &&
                    taskSnapshot.data().status === 'done'
                  ) {
                    const now = Timestamp.now();

                    await updateDoc(
                      doc(db, 'motoboy_assignments', assignment.id),
                      {
                        status: 'completed',
                        completed_at: now,
                        updated_at: now,
                      }
                    );

                    assignment.status = 'completed';
                    assignment.completed_at = now;
                  }
                } catch (error) {
                  console.warn(
                    'Erro ao sincronizar corrida com tarefa:',
                    error
                  );
                }
              })
            );
          }

          setMotoboyAssignments(
            raw.map((r) => ({
              id: r.id,
              description: r.description || '',
              assignedTo: r.assigned_to || null,
              assignedBy: r.assigned_by || '',
              status: r.status || 'pending',
              notes: r.notes || null,
              createdAt: toIso(r.created_at) || new Date().toISOString(),
              acceptedAt: toIso(r.accepted_at),
              completedAt: toIso(r.completed_at),
              rideValue: Number(r.ride_value) || 0,
              clientName: r.client_name || '',
              location: r.location || '',
              taskId: r.task_id || null,
              scheduledFor: toIso(r.scheduled_for) || r.scheduled_for || null,
            }))
          );
        },
        (error) => console.error('Erro em motoboy_assignments:', error)
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Tracking
  const addTracking = useCallback(
    async (
      code: string,
      desc: string,
      createdBy: string,
      clientName?: string,
      shippingMethod?: string
    ) => {
      await addDoc(collection(db, 'tracking_entries'), {
        tracking_code: code,
        description: desc,
        status: 'pending',
        created_by: createdBy,
        client_name: (clientName || '').toUpperCase(),
        shipping_method: shippingMethod || '',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const updateTrackingStatus = useCallback(
    async (id: string, status: string) => {
      await updateDoc(doc(db, 'tracking_entries', id), {
        status,
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const deleteTracking = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'tracking_entries', id));
  }, []);

  // Reverse Shipments
  const requestReverseShipment = useCallback(
    async (data: {
      invoiceNumber: string;
      itemName: string;
      itemValue: number;
      saleDate: string;
      returnReason: string;
      productImageUrl?: string | null;
      requestedBy: string;
    }) => {
      const desc = `${data.returnReason} - ${data.itemName} (NF: ${data.invoiceNumber})`;

      await addDoc(collection(db, 'reverse_shipments'), {
        description: desc,
        tracking_code: null,
        status: 'pending',
        requested_by: data.requestedBy,
        responded_by: null,
        invoice_number: data.invoiceNumber,
        item_name: data.itemName,
        item_value: data.itemValue,
        sale_date: data.saleDate,
        return_reason: data.returnReason,
        product_image_url: data.productImageUrl || null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      const nowIso = new Date().toISOString();
      const deadline = new Date();
      deadline.setHours(23, 59, 59, 999);
      const imageUrls = data.productImageUrl ? [data.productImageUrl] : [];

      await addDoc(collection(db, 'tasks'), {
        title: `📦 Envio Reverso: ${data.itemName}`,
        description: `Motivo: ${data.returnReason}\nItem: ${data.itemName}\nValor: R$ ${data.itemValue.toFixed(
          2
        )}\nNF/Pedido: ${data.invoiceNumber}\nData da Venda: ${data.saleDate}`,
        status: 'todo',
        priority: 'high',
        assignee_id: 'emp-12',
        created_by: data.requestedBy,
        deadline: deadline.toISOString().split('T')[0],
        sector: 'garantias',
        status_history: [{ status: 'todo', enteredAt: nowIso }],
        image_urls: imageUrls,
        image_url: imageUrls[0] || null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const respondReverseShipment = useCallback(
    async (id: string, code: string, respondedBy: string) => {
      await updateDoc(doc(db, 'reverse_shipments', id), {
        tracking_code: code,
        status: 'responded',
        responded_by: respondedBy,
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  // Receipts
  const addReceipt = useCallback(
    async (desc: string, photoUrl: string | null, createdBy: string) => {
      await addDoc(collection(db, 'receipts'), {
        description: desc,
        photo_url: photoUrl,
        created_by: createdBy,
        liked_by: [],
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const toggleLikeReceipt = useCallback(
    async (id: string, userId: string) => {
      const receipt = receipts.find((r) => r.id === id);
      if (!receipt) return;

      const liked = receipt.likedBy.includes(userId)
        ? receipt.likedBy.filter((u) => u !== userId)
        : [...receipt.likedBy, userId];

      await updateDoc(doc(db, 'receipts', id), {
        liked_by: liked,
        updated_at: Timestamp.now(),
      });
    },
    [receipts]
  );

  // Counter Quotes
  const requestQuote = useCallback(
    async (
      productName: string,
      desc: string,
      qty: number,
      requestedBy: string
    ) => {
      await addDoc(collection(db, 'counter_quotes'), {
        product_name: productName,
        description: desc,
        quantity: qty,
        status: 'pending',
        requested_by: requestedBy,
        responded_by: null,
        response: null,
        claimed_by: null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const claimQuote = useCallback(async (id: string, claimedBy: string) => {
    await updateDoc(doc(db, 'counter_quotes', id), {
      claimed_by: claimedBy,
      updated_at: Timestamp.now(),
    });
  }, []);

  const respondQuote = useCallback(
    async (id: string, response: string, respondedBy: string) => {
      await updateDoc(doc(db, 'counter_quotes', id), {
        response,
        status: 'responded',
        responded_by: respondedBy,
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const deleteQuote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'counter_quotes', id));
  }, []);

  // Low Stock
  const reportLowStock = useCallback(
    async (
      name: string,
      desc: string,
      photoUrl: string | null,
      reportedBy: string
    ) => {
      await addDoc(collection(db, 'low_stock_items'), {
        product_name: name,
        description: desc,
        photo_url: photoUrl,
        status: 'pending',
        reported_by: reportedBy,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const resolveLowStock = useCallback(async (id: string) => {
    await updateDoc(doc(db, 'low_stock_items', id), {
      status: 'resolved',
      updated_at: Timestamp.now(),
    });
  }, []);

  const deleteLowStock = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'low_stock_items', id));
  }, []);

  // Supply Requests
  const requestSupply = useCallback(
    async (
      name: string,
      desc: string,
      qty: number,
      requestedBy: string
    ) => {
      await addDoc(collection(db, 'supply_requests'), {
        item_name: name,
        description: desc,
        quantity: qty,
        status: 'pending',
        requested_by: requestedBy,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  const updateSupplyStatus = useCallback(
    async (id: string, status: string) => {
      await updateDoc(doc(db, 'supply_requests', id), {
        status,
        updated_at: Timestamp.now(),
      });
    },
    []
  );

  // Motoboy
  const assignMotoboy = useCallback(
    async (
      desc: string,
      assignedTo: string,
      assignedBy: string,
      rideValue?: number,
      clientName?: string,
      location?: string,
      scheduledFor?: string | null
    ) => {
      const nowIso = new Date().toISOString();

      if (scheduledFor) {
        await addDoc(collection(db, 'motoboy_assignments'), {
          description: desc,
          assigned_to: assignedTo || assignedBy,
          assigned_by: assignedBy,
          ride_value: rideValue || 15,
          client_name: clientName || '',
          location: location || '',
          status: 'pending_approval',
          notes: null,
          task_id: null,
          scheduled_for: scheduledFor,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
          accepted_at: null,
          completed_at: null,
        });

        return;
      }

      const taskTitle = clientName
        ? `🏍️ Corrida: ${clientName}`
        : `🏍️ Corrida: ${desc}`;

      const taskDesc = [
        desc,
        clientName ? `Cliente: ${clientName}` : '',
        location ? `Local: ${location}` : '',
        rideValue ? `Valor: R$ ${rideValue.toFixed(2)}` : '',
      ]
        .filter(Boolean)
        .join(' • ');

      const deadline = new Date();
      deadline.setHours(23, 59, 59, 999);

      const taskRef = await addDoc(collection(db, 'tasks'), {
        title: taskTitle,
        description: taskDesc,
        status: 'todo',
        priority: 'high',
        assignee_id: assignedTo,
        created_by: assignedBy,
        deadline: deadline.toISOString().split('T')[0],
        sector: 'motoboys',
        status_history: [{ status: 'todo', enteredAt: nowIso }],
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });

      await addDoc(collection(db, 'motoboy_assignments'), {
        description: desc,
        assigned_to: assignedTo,
        assigned_by: assignedBy,
        ride_value: rideValue || 15,
        client_name: clientName || '',
        location: location || '',
        status: 'pending',
        notes: null,
        task_id: taskRef.id,
        scheduled_for: null,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        accepted_at: null,
        completed_at: null,
      });
    },
    []
  );

  const updateMotoboyStatus = useCallback(
    async (id: string, status: string, notes?: string) => {
      const update: any = {
        status,
        updated_at: Timestamp.now(),
      };

      if (notes !== undefined) {
        update.notes = notes;
      }

      if (status === 'accepted') {
        update.accepted_at = Timestamp.now();
      }

      if (status === 'completed') {
        update.completed_at = Timestamp.now();
      }

      await updateDoc(doc(db, 'motoboy_assignments', id), update);
    },
    []
  );

  const deleteMotoboyAssignment = useCallback(
    async (id: string) => {
      const assignment = motoboyAssignments.find((a) => a.id === id);

      await deleteDoc(doc(db, 'motoboy_assignments', id));

      if (!assignment) return;

      // Melhor caso: usa o vínculo direto.
      if (assignment.taskId) {
        try {
          await deleteDoc(doc(db, 'tasks', assignment.taskId));
          return;
        } catch (error) {
          console.warn('Falha ao remover task vinculada diretamente:', error);
        }
      }

      // Fallback para registros legados sem task_id.
      if (!assignment.assignedTo) return;

      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignee_id', '==', assignment.assignedTo),
        where('sector', '==', 'motoboys')
      );

      const tasksSnapshot = await getDocs(tasksQuery);

      const matchingTask = tasksSnapshot.docs.find((taskDoc) => {
        const task = taskDoc.data();
        const title = String(task.title || '');
        const description = String(task.description || '');

        return (
          (!!assignment.clientName &&
            title.includes(assignment.clientName)) ||
          description.includes(assignment.description)
        );
      });

      if (matchingTask) {
        await deleteDoc(doc(db, 'tasks', matchingTask.id));
      }
    },
    [motoboyAssignments]
  );

  const updateMotoboyAssignment = useCallback(
    async (
      id: string,
      data: {
        description?: string;
        clientName?: string;
        location?: string;
        rideValue?: number;
        notes?: string;
        assignedTo?: string | null;
        scheduledFor?: string | null;
      }
    ) => {
      const update: any = {
        updated_at: Timestamp.now(),
      };

      if (data.description !== undefined) {
        update.description = data.description;
      }
      if (data.clientName !== undefined) {
        update.client_name = data.clientName;
      }
      if (data.location !== undefined) {
        update.location = data.location;
      }
      if (data.rideValue !== undefined) {
        update.ride_value = data.rideValue;
      }
      if (data.notes !== undefined) {
        update.notes = data.notes;
      }
      if (data.assignedTo !== undefined) {
        update.assigned_to = data.assignedTo;
      }
      if (data.scheduledFor !== undefined) {
        update.scheduled_for = data.scheduledFor;
      }

      await updateDoc(doc(db, 'motoboy_assignments', id), update);

      const current = motoboyAssignments.find((a) => a.id === id);
      if (!current) return;

      const newAssignee =
        data.assignedTo !== undefined ? data.assignedTo : current.assignedTo;

      const newClientName =
        data.clientName !== undefined ? data.clientName : current.clientName;

      const newDesc =
        data.description !== undefined ? data.description : current.description;

      const newLocation =
        data.location !== undefined ? data.location : current.location;

      const newRideValue =
        data.rideValue !== undefined ? data.rideValue : current.rideValue;

      const taskTitle = newClientName
        ? `🏍️ Corrida: ${newClientName}`
        : `🏍️ Corrida: ${newDesc}`;

      const taskDesc = [
        newDesc,
        newClientName ? `Cliente: ${newClientName}` : '',
        newLocation ? `Local: ${newLocation}` : '',
        newRideValue
          ? `Valor: R$ ${Number(newRideValue).toFixed(2)}`
          : '',
      ]
        .filter(Boolean)
        .join(' • ');

      if (data.assignedTo === null && current.taskId) {
        await deleteDoc(doc(db, 'tasks', current.taskId));

        await updateDoc(doc(db, 'motoboy_assignments', id), {
          task_id: null,
          status: 'pending',
          accepted_at: null,
          updated_at: Timestamp.now(),
        });

        return;
      }

      if (current.taskId) {
        const taskUpdate: any = {
          title: taskTitle,
          description: taskDesc,
          updated_at: Timestamp.now(),
        };

        if (data.assignedTo !== undefined && data.assignedTo) {
          taskUpdate.assignee_id = data.assignedTo;
        }

        await updateDoc(doc(db, 'tasks', current.taskId), taskUpdate);
        return;
      }

      if (data.assignedTo !== undefined && newAssignee) {
        const nowIso = new Date().toISOString();
        const deadline = new Date();
        deadline.setHours(23, 59, 59, 999);

        const taskRef = await addDoc(collection(db, 'tasks'), {
          title: taskTitle,
          description: taskDesc,
          status: 'todo',
          priority: 'high',
          assignee_id: newAssignee,
          created_by: current.assignedBy || newAssignee,
          deadline: deadline.toISOString().split('T')[0],
          sector: 'motoboys',
          status_history: [{ status: 'todo', enteredAt: nowIso }],
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        });

        await updateDoc(doc(db, 'motoboy_assignments', id), {
          task_id: taskRef.id,
          updated_at: Timestamp.now(),
        });
      }
    },
    [motoboyAssignments]
  );

  const unassignMotoboy = useCallback(
    async (id: string) => {
      await updateMotoboyAssignment(id, {
        assignedTo: null,
      });
    },
    [updateMotoboyAssignment]
  );

  return {
    tracking,
    reverseShipments,
    receipts,
    counterQuotes,
    lowStockItems,
    supplyRequests,
    motoboyAssignments,
    addTracking,
    updateTrackingStatus,
    deleteTracking,
    requestReverseShipment,
    respondReverseShipment,
    addReceipt,
    toggleLikeReceipt,
    requestQuote,
    claimQuote,
    respondQuote,
    deleteQuote,
    reportLowStock,
    resolveLowStock,
    deleteLowStock,
    requestSupply,
    updateSupplyStatus,
    assignMotoboy,
    updateMotoboyStatus,
    deleteMotoboyAssignment,
    updateMotoboyAssignment,
    unassignMotoboy,
  };
};
