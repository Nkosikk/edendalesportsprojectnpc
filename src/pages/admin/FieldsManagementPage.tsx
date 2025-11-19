import React, { useEffect, useState } from 'react';
import fieldService from '../../services/fieldsService';
import { adminService } from '../../services/adminService';
import type { SportsField } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Card, CardContent } from '../../components/ui/Card';
import FieldForm from '../../components/admin/FieldForm';
import toast from 'react-hot-toast';

const FieldsManagementPage: React.FC = () => {
  const [fields, setFields] = useState<SportsField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SportsField | null>(null);

  const [sortBy, setSortBy] = useState<'id'|'name'|'sport_type'|'capacity'|'hourly_rate'|'is_active'>('name');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [blockFieldId, setBlockFieldId] = useState<number | ''>('');
  const [blockDate, setBlockDate] = useState<string>('');
  const [blockStart, setBlockStart] = useState<string>('16:00');
  const [blockEnd, setBlockEnd] = useState<string>('17:00');
  const [blockReason, setBlockReason] = useState<string>('Maintenance');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // Admin always sees all fields (both active and inactive) with active_only=false
      const data = await fieldService.getAllFields(false);
      setFields(data);
    } catch (error: any) {
      console.error('Failed to fetch fields', error);
      toast.error(error?.response?.data?.message || 'Unable to load fields');
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayFields = (() => {
    const copy = [...fields];
    copy.sort((a, b) => {
      const vA: any = (a as any)[sortBy];
      const vB: any = (b as any)[sortBy];
      let cmp = 0;
      if (typeof vA === 'string' || typeof vB === 'string') {
        cmp = String(vA ?? '').localeCompare(String(vB ?? ''));
      } else {
        cmp = Number(vA ?? 0) - Number(vB ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  })();

  const toggleActive = async (field: SportsField) => {
    try {
      // Optimistic UI update
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_active: !field.is_active } as SportsField : f));

      if (field.is_active) {
        await fieldService.deactivateField(field.id);
        toast.success('Field deactivated');
      } else {
        await fieldService.activateField(field.id);
        toast.success('Field activated');
      }
      // Refresh from server (with cache-busting inside service)
      load();
    } catch {
      // Revert optimistic update on error
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_active: field.is_active } as SportsField : f));
      toast.error('Failed to update field status');
    }
  };

  const handleEdit = (field: SportsField) => setEditing(field);

  const handleBlock = async () => {
    if (!blockFieldId || !blockDate) {
      toast.error('Field and date required');
      return;
    }
    const payload = {
      field_id: Number(blockFieldId),
      date: blockDate,
      start_time: blockStart,
      end_time: blockEnd,
      reason: blockReason,
    };
    try {
      setIsBlocking(true);
      console.debug('POST /admin/block-slot', payload);
      await adminService.blockSlot(payload);
      toast.success('Slot blocked');
    } catch (e: any) {
      console.error('Block slot failed', e);
      toast.error(e?.response?.data?.message || e?.message || 'Failed to block slot');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!blockFieldId || !blockDate) {
      toast.error('Field and date required');
      return;
    }
    const payload = {
      field_id: Number(blockFieldId),
      date: blockDate,
      start_time: blockStart,
      end_time: blockEnd,
      reason: blockReason,
    };
    try {
      setIsUnblocking(true);
      console.debug('POST /admin/unblock-slot', payload);
      await adminService.unblockSlot(payload);
      toast.success('Slot unblocked');
    } catch (e: any) {
      console.error('Unblock slot failed', e);
      toast.error(e?.response?.data?.message || e?.message || 'Failed to unblock slot');
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fields Management</h1>
      </div>

      <Card className="mb-4">
        <CardContent className="px-4 py-3">
          <h2 className="text-base font-semibold mb-2">{editing ? 'Edit Field' : 'Create Field'}</h2>
          <div className="max-w-4xl">
            <FieldForm
              editingField={editing}
              onCancelEdit={() => setEditing(null)}
              onCreated={(f) => { setFields(prev => [...prev, f]); }}
              onUpdated={(f) => { setFields(prev => prev.map(x => x.id === f.id ? f : x)); setEditing(null); }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold mb-4">Block / Unblock Slot</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700">Field</label>
              <select className="input text-sm" value={blockFieldId} onChange={e => setBlockFieldId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Select</option>
                {fields.filter(f => f.is_active).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700">Date</label>
              <input type="date" className="input text-sm" value={blockDate} onChange={e => setBlockDate(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700">Start</label>
              <input type="time" className="input text-sm" value={blockStart} onChange={e => setBlockStart(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700">End</label>
              <input type="time" className="input text-sm" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} />
            </div>
            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-medium text-gray-700">Reason</label>
              <input className="input text-sm" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleBlock} disabled={isBlocking || !blockFieldId || !blockDate}>
              {isBlocking ? 'Blocking…' : 'Block Slot'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleUnblock} disabled={isUnblocking || !blockFieldId || !blockDate}>
              {isUnblocking ? 'Unblocking…' : 'Unblock Slot'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700 font-medium">Showing all fields (active & inactive)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700">Sort by</span>
              <select
                className="input text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="name">Name</option>
                <option value="sport_type">Type</option>
                <option value="capacity">Capacity</option>
                <option value="hourly_rate">Hourly Rate</option>
                <option value="is_active">Active</option>
                <option value="id">ID</option>
              </select>
              <select
                className="input text-sm"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as any)}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table
              data={displayFields}
              keyExtractor={(f) => f.id.toString()}
              columns={[
                { key: 'id', title: 'ID' },
                { key: 'name', title: 'Name' },
                { key: 'sport_type', title: 'Type' },
                { key: 'capacity', title: 'Capacity' },
                { key: 'hourly_rate', title: 'Hourly Rate', render: (v: number) => `R ${Number(v || 0).toFixed(2)}` },
                { key: 'is_active', title: 'Active', render: (v: boolean) => v ? 'Yes' : 'No' },
                {
                  key: 'actions',
                  title: 'Actions',
                  render: (_: any, row: SportsField) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>Edit</Button>
                    </div>
                  )
                }
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FieldsManagementPage;
