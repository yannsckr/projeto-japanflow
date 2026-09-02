import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export const useSupabaseDepartmental = () => {
  const [tracking, setTracking] = useState<TrackingEntry[]>([]);
  const [reverseShipments, setReverseShipments] = useState<ReverseShipment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [counterQuotes, setCounterQuotes] = useState<CounterQuote[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [motoboyAssignments, setMotoboyAssignments] = useState<MotoboyAssignment[]>([]);

  const fetchAll = useCallback(async () => {
    const [t, rs, rc, cq, ls, sr, ma] = await Promise.all([
      supabase
        .from('tracking_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('reverse_shipments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('receipts').select('*').order('created_at', { ascending: false }).limit(500),
      supabase
        .from('counter_quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('low_stock_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('supply_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('motoboy_assignments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (t.data)
      setTracking(
        t.data.map((r: any) => ({
          id: r.id,
          trackingCode: r.tracking_code,
          description: r.description,
          status: r.status,
          createdBy: r.created_by,
          createdAt: r.created_at,
          clientName: r.client_name || '',
          shippingMethod: r.shipping_method || '',
        }))
      );
    if (rs.data)
      setReverseShipments(
        rs.data.map((r: any) => ({
          id: r.id,
          description: r.description,
          trackingCode: r.tracking_code,
          status: r.status,
          requestedBy: r.requested_by,
          respondedBy: r.responded_by,
          createdAt: r.created_at,
          invoiceNumber: r.invoice_number || '',
          itemName: r.item_name || '',
          itemValue: Number(r.item_value) || 0,
          saleDate: r.sale_date || null,
          returnReason: r.return_reason || '',
          productImageUrl: r.product_image_url || null,
        }))
      );
    if (rc.data)
      setReceipts(
        rc.data.map((r: any) => ({
          id: r.id,
          description: r.description,
          photoUrl: r.photo_url,
          createdBy: r.created_by,
          likedBy: (r.liked_by as string[]) || [],
          createdAt: r.created_at,
        }))
      );
    if (cq.data)
      setCounterQuotes(
        cq.data.map((r: any) => ({
          id: r.id,
          productName: r.product_name,
          description: r.description,
          quantity: r.quantity,
          status: r.status,
          requestedBy: r.requested_by,
          respondedBy: r.responded_by,
          response: r.response,
          createdAt: r.created_at,
          claimedBy: r.claimed_by,
        }))
      );
    if (ls.data)
      setLowStockItems(
        ls.data.map((r: any) => ({
          id: r.id,
          productName: r.product_name,
          description: r.description,
          photoUrl: r.photo_url,
          status: r.status,
          reportedBy: r.reported_by,
          createdAt: r.created_at,
        }))
      );
    if (sr.data)
      setSupplyRequests(
        sr.data.map((r: any) => ({
          id: r.id,
          itemName: r.item_name,
          description: r.description,
          quantity: r.quantity,
          status: r.status,
          requestedBy: r.requested_by,
          createdAt: r.created_at,
        }))
      );
    if (ma.data) {
      // Sync in background without blocking UI
      const maData = [...ma.data];
      const pendingWithTaskId = maData.filter((r: any) => r.task_id && r.status !== 'completed');
      if (pendingWithTaskId.length > 0) {
        const taskIds = pendingWithTaskId.map((r: any) => r.task_id);
        supabase
          .from('tasks')
          .select('id')
          .in('id', taskIds)
          .eq('status', 'done')
          .then(({ data: doneTasks }) => {
            if (doneTasks && doneTasks.length > 0) {
              const doneTaskIds = new Set(doneTasks.map((t) => t.id));
              const now = new Date().toISOString();
              for (const r of pendingWithTaskId) {
                if (doneTaskIds.has(r.task_id)) {
                  supabase
                    .from('motoboy_assignments')
                    .update({ status: 'completed', completed_at: now, updated_at: now })
                    .eq('id', r.id);
                  r.status = 'completed';
                  r.completed_at = now;
                }
              }
              // Update state after sync
              setMotoboyAssignments(
                maData.map((r: any) => ({
                  id: r.id,
                  description: r.description,
                  assignedTo: r.assigned_to,
                  assignedBy: r.assigned_by,
                  status: r.status,
                  notes: r.notes,
                  createdAt: r.created_at,
                  acceptedAt: r.accepted_at,
                  completedAt: r.completed_at,
                  rideValue: Number(r.ride_value) || 0,
                  clientName: r.client_name || '',
                  location: r.location || '',
                  taskId: r.task_id || null,
                  scheduledFor: r.scheduled_for || null,
                }))
              );
            }
          });
      }
      // Set state immediately without waiting for sync
      setMotoboyAssignments(
        maData.map((r: any) => ({
          id: r.id,
          description: r.description,
          assignedTo: r.assigned_to,
          assignedBy: r.assigned_by,
          status: r.status,
          notes: r.notes,
          createdAt: r.created_at,
          acceptedAt: r.accepted_at,
          completedAt: r.completed_at,
          rideValue: Number(r.ride_value) || 0,
          clientName: r.client_name || '',
          location: r.location || '',
          taskId: r.task_id || null,
          scheduledFor: r.scheduled_for || null,
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const tables = [
      'tracking_entries',
      'reverse_shipments',
      'receipts',
      'counter_quotes',
      'low_stock_items',
      'supply_requests',
      'motoboy_assignments',
    ];
    const channels = tables.map((table) =>
      supabase
        .channel(`${table}-rt`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchAll())
        .subscribe()
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [fetchAll]);

  // Tracking
  const addTracking = useCallback(
    async (
      code: string,
      desc: string,
      createdBy: string,
      clientName?: string,
      shippingMethod?: string
    ) => {
      await supabase.from('tracking_entries').insert({
        tracking_code: code,
        description: desc,
        created_by: createdBy,
        client_name: (clientName || '').toUpperCase(),
        shipping_method: shippingMethod || '',
      });
    },
    []
  );
  const updateTrackingStatus = useCallback(async (id: string, status: string) => {
    await supabase
      .from('tracking_entries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  }, []);
  const deleteTracking = useCallback(async (id: string) => {
    await supabase.from('tracking_entries').delete().eq('id', id);
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
      await supabase.from('reverse_shipments').insert({
        description: desc,
        requested_by: data.requestedBy,
        invoice_number: data.invoiceNumber,
        item_name: data.itemName,
        item_value: data.itemValue,
        sale_date: data.saleDate,
        return_reason: data.returnReason,
        product_image_url: data.productImageUrl || null,
      });

      // Create task for William (emp-12)
      const now = new Date().toISOString();
      const deadline = new Date();
      deadline.setHours(23, 59, 59, 999);
      const imageUrls = data.productImageUrl ? [data.productImageUrl] : [];
      await supabase.from('tasks').insert({
        title: `📦 Envio Reverso: ${data.itemName}`,
        description: `Motivo: ${data.returnReason}\nItem: ${data.itemName}\nValor: R$ ${data.itemValue.toFixed(2)}\nNF/Pedido: ${data.invoiceNumber}\nData da Venda: ${data.saleDate}`,
        status: 'todo',
        priority: 'high',
        assignee_id: 'emp-12',
        created_by: data.requestedBy,
        deadline: deadline.toISOString().split('T')[0],
        sector: 'garantias',
        status_history: [{ status: 'todo', enteredAt: now }] as any,
        image_urls: imageUrls as any,
      });
    },
    []
  );
  const respondReverseShipment = useCallback(
    async (id: string, code: string, respondedBy: string) => {
      await supabase
        .from('reverse_shipments')
        .update({
          tracking_code: code,
          status: 'responded',
          responded_by: respondedBy,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    },
    []
  );

  // Receipts
  const addReceipt = useCallback(
    async (desc: string, photoUrl: string | null, createdBy: string) => {
      await supabase
        .from('receipts')
        .insert({ description: desc, photo_url: photoUrl, created_by: createdBy });
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
      await supabase
        .from('receipts')
        .update({ liked_by: liked as any })
        .eq('id', id);
    },
    [receipts]
  );

  // Counter Quotes
  const requestQuote = useCallback(
    async (productName: string, desc: string, qty: number, requestedBy: string) => {
      await supabase.from('counter_quotes').insert({
        product_name: productName,
        description: desc,
        quantity: qty,
        requested_by: requestedBy,
      });
    },
    []
  );
  const claimQuote = useCallback(async (id: string, claimedBy: string) => {
    await supabase
      .from('counter_quotes')
      .update({ claimed_by: claimedBy, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
  }, []);
  const respondQuote = useCallback(async (id: string, response: string, respondedBy: string) => {
    await supabase
      .from('counter_quotes')
      .update({
        response,
        status: 'responded',
        responded_by: respondedBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }, []);
  const deleteQuote = useCallback(async (id: string) => {
    await supabase.from('counter_quotes').delete().eq('id', id);
  }, []);

  // Low Stock
  const reportLowStock = useCallback(
    async (name: string, desc: string, photoUrl: string | null, reportedBy: string) => {
      await supabase.from('low_stock_items').insert({
        product_name: name,
        description: desc,
        photo_url: photoUrl,
        reported_by: reportedBy,
      });
    },
    []
  );
  const resolveLowStock = useCallback(async (id: string) => {
    await supabase.from('low_stock_items').update({ status: 'resolved' }).eq('id', id);
  }, []);
  const deleteLowStock = useCallback(async (id: string) => {
    await supabase.from('low_stock_items').delete().eq('id', id);
  }, []);

  // Supply Requests
  const requestSupply = useCallback(
    async (name: string, desc: string, qty: number, requestedBy: string) => {
      await supabase
        .from('supply_requests')
        .insert({ item_name: name, description: desc, quantity: qty, requested_by: requestedBy });
    },
    []
  );
  const updateSupplyStatus = useCallback(async (id: string, status: string) => {
    await supabase
      .from('supply_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

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
      const now = new Date().toISOString();

      // If scheduled, skip kanban task creation; goes straight to pending_approval queue.
      if (scheduledFor) {
        const { error: assignError } = await supabase.from('motoboy_assignments').insert({
          description: desc,
          assigned_to: assignedTo || assignedBy,
          assigned_by: assignedBy,
          ride_value: rideValue || 15,
          client_name: clientName || '',
          location: location || '',
          status: 'pending_approval',
          scheduled_for: scheduledFor,
        } as any);
        if (assignError) {
          console.error('Erro ao agendar corrida:', assignError);
          throw new Error(assignError.message || 'Erro ao agendar corrida');
        }
        return;
      }

      const taskTitle = clientName ? `🏍️ Corrida: ${clientName}` : `🏍️ Corrida: ${desc}`;
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
      const statusHistory = [{ status: 'todo', enteredAt: now }];

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: taskTitle,
          description: taskDesc,
          status: 'todo',
          priority: 'high',
          assignee_id: assignedTo,
          created_by: assignedBy,
          deadline: deadline.toISOString().split('T')[0],
          sector: 'motoboys',
          status_history: statusHistory as any,
        })
        .select('id')
        .single();

      if (taskError) {
        console.error('Erro ao criar tarefa de motoboy:', taskError);
        throw new Error(taskError.message || 'Erro ao criar tarefa');
      }

      const { error: assignError } = await supabase.from('motoboy_assignments').insert({
        description: desc,
        assigned_to: assignedTo,
        assigned_by: assignedBy,
        ride_value: rideValue || 15,
        client_name: clientName || '',
        location: location || '',
        status: 'pending',
        task_id: taskData?.id || null,
      });

      if (assignError) {
        console.error('Erro ao criar corrida:', assignError);
        throw new Error(assignError.message || 'Erro ao criar corrida');
      }
    },
    []
  );
  const updateMotoboyStatus = useCallback(async (id: string, status: string, notes?: string) => {
    const update: any = { status, updated_at: new Date().toISOString() };
    if (notes !== undefined) update.notes = notes;
    if (status === 'accepted') update.accepted_at = new Date().toISOString();
    if (status === 'completed') update.completed_at = new Date().toISOString();
    await supabase.from('motoboy_assignments').update(update).eq('id', id);
  }, []);

  const deleteMotoboyAssignment = useCallback(
    async (id: string) => {
      // Find the assignment to get details for matching the task
      const assignment = motoboyAssignments.find((a) => a.id === id);
      await supabase.from('motoboy_assignments').delete().eq('id', id);
      // Also delete related task from motoboy's kanban
      if (assignment) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, description')
          .eq('assignee_id', assignment.assignedTo)
          .eq('sector', 'motoboys');
        if (tasks) {
          const matchingTask = tasks.find(
            (t) =>
              (t.title.includes(assignment.clientName || '') && assignment.clientName) ||
              t.description.includes(assignment.description)
          );
          if (matchingTask) {
            await supabase.from('tasks').delete().eq('id', matchingTask.id);
          }
        }
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
      const update: any = { updated_at: new Date().toISOString() };
      if (data.description !== undefined) update.description = data.description;
      if (data.clientName !== undefined) update.client_name = data.clientName;
      if (data.location !== undefined) update.location = data.location;
      if (data.rideValue !== undefined) update.ride_value = data.rideValue;
      if (data.notes !== undefined) update.notes = data.notes;
      if (data.assignedTo !== undefined) update.assigned_to = data.assignedTo;
      if (data.scheduledFor !== undefined) update.scheduled_for = data.scheduledFor;
      await supabase.from('motoboy_assignments').update(update).eq('id', id);

      // Sync the linked kanban task so the new motoboy sees the ride in "Meu Quadro"
      const current = motoboyAssignments.find((a) => a.id === id);
      if (current) {
        const newAssignee = data.assignedTo !== undefined ? data.assignedTo : current.assignedTo;
        const newClientName = data.clientName !== undefined ? data.clientName : current.clientName;
        const newDesc = data.description !== undefined ? data.description : current.description;
        const newLocation = data.location !== undefined ? data.location : current.location;
        const newRideValue = data.rideValue !== undefined ? data.rideValue : current.rideValue;

        const taskTitle = newClientName ? `🏍️ Corrida: ${newClientName}` : `🏍️ Corrida: ${newDesc}`;
        const taskDesc = [
          newDesc,
          newClientName ? `Cliente: ${newClientName}` : '',
          newLocation ? `Local: ${newLocation}` : '',
          newRideValue ? `Valor: R$ ${Number(newRideValue).toFixed(2)}` : '',
        ]
          .filter(Boolean)
          .join(' • ');

        // If unassigning (assignedTo set to null), delete the linked task so it disappears from the previous motoboy's board
        if (data.assignedTo === null && current.taskId) {
          await supabase.from('tasks').delete().eq('id', current.taskId);
          await supabase
            .from('motoboy_assignments')
            .update({ task_id: null, status: 'pending', accepted_at: null })
            .eq('id', id);
        } else if (current.taskId) {
          const taskUpdate: any = {
            title: taskTitle,
            description: taskDesc,
            updated_at: new Date().toISOString(),
          };
          if (data.assignedTo !== undefined && data.assignedTo)
            taskUpdate.assignee_id = data.assignedTo;
          await supabase.from('tasks').update(taskUpdate).eq('id', current.taskId);
        } else if (data.assignedTo !== undefined && newAssignee) {
          // No linked task (e.g. older or scheduled ride being reassigned) — create one so the new motoboy sees it
          const now = new Date().toISOString();
          const deadline = new Date();
          deadline.setHours(23, 59, 59, 999);
          const { data: taskData } = await supabase
            .from('tasks')
            .insert({
              title: taskTitle,
              description: taskDesc,
              status: 'todo',
              priority: 'high',
              assignee_id: newAssignee,
              created_by: current.assignedBy || newAssignee,
              deadline: deadline.toISOString().split('T')[0],
              sector: 'motoboys',
              status_history: [{ status: 'todo', enteredAt: now }] as any,
            })
            .select('id')
            .single();
          if (taskData?.id) {
            await supabase
              .from('motoboy_assignments')
              .update({ task_id: taskData.id })
              .eq('id', id);
          }
        }
      }
    },
    [motoboyAssignments]
  );

  const unassignMotoboy = useCallback(
    async (id: string) => {
      await updateMotoboyAssignment(id, { assignedTo: null });
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
