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
import { isPublicHoliday } from '../../utils/scheduling';

const FieldsManagementPage: React.FC = () => {
  const [fields, setFields] = useState<SportsField[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SportsField | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
  
  useEffect(() => {
    setCurrentPage(1);
  }, [fields.length, pageSize]);

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

  const totalPages = Math.ceil(displayFields.length / pageSize);
  const paginatedFields = displayFields.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
    } catch (error: any) {
      // Revert optimistic update on error
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, is_active: field.is_active } as SportsField : f));
      const message = error?.response?.data?.message || error?.message || 'Failed to update field status';
      toast.error(message);
    }
  };

  const validateBlockTime = (startTime: string, endTime: string, date: string): string | null => {
    // Parse time strings
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Validate time format
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      return 'Invalid time format';
    }
    
    // Check if times are within 24-hour format
    if (startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
        endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
      return 'Time must be in 24-hour format (00:00-23:59)';
    }
    
    // Check if start time is before end time
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    if (startMinutes >= endMinutes) {
      return 'Start time must be before end time';
    }
    
    // Check operating hours based on date
    const blockDate = new Date(`${date}T00:00:00`);
    const isWeekendDay = blockDate.getDay() === 0 || blockDate.getDay() === 6;
    const holiday = isPublicHoliday(blockDate);
    const operatingStart = (isWeekendDay || holiday) ? 9 : 16; // Weekend & holidays: 09:00, Weekday: 16:00
    const operatingEnd = 22; // Both: 22:00
    
    if (startHour < operatingStart || endHour > operatingEnd || (endHour === operatingEnd && endMin > 0)) {
      const hoursText = (isWeekendDay || holiday) ? '09:00-22:00' : '16:00-22:00';
      return `Time must be within operating hours: ${hoursText}`;
    }
    
    return null;
  };

  const handleBlock = async () => {
    if (!blockFieldId || !blockDate) {
      toast.error('Field and date required');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(`${blockDate}T00:00:00`);
    if (selectedDate < today) {
      toast.error(`Cannot block slots for ${blockDate}: date is in the past`);
      return;
    }
    
    // Additional validation for past times on today
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      const [startHour, startMin] = blockStart.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(startHour, startMin, 0, 0);
      if (startTime <= now) {
        toast.error(`Cannot block ${blockStart}-${blockEnd}: time has already passed`);
        return;
      }
    }
    
    // Validate time input
    const timeError = validateBlockTime(blockStart, blockEnd, blockDate);
    if (timeError) {
      toast.error(timeError);
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
      load();
    } catch (e: any) {
      console.error('Block slot failed', e);
      const rawMessage = e?.response?.data?.message || e?.message || '';
      if (/already.*blocked/i.test(String(rawMessage))) {
        toast.error(`Time slot ${blockStart}-${blockEnd} is already blocked`);
      } else if (/overlap/i.test(String(rawMessage))) {
        toast.error(`Cannot block ${blockStart}-${blockEnd}: overlaps with existing booking`);
      } else {
        toast.error(rawMessage || `Failed to block ${blockStart}-${blockEnd}`);
      }
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (!blockFieldId || !blockDate) {
      toast.error('Field and date required');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(`${blockDate}T00:00:00`);
    if (selectedDate < today) {
      toast.error(`Cannot block slots for ${blockDate}: date is in the past`);
      return;
    }
    
    // Additional validation for past times on today
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      const [startHour, startMin] = blockStart.split(':').map(Number);
      const startTime = new Date();
      startTime.setHours(startHour, startMin, 0, 0);
      if (startTime <= now) {
        toast.error(`Cannot block ${blockStart}-${blockEnd}: time has already passed`);
        return;
      }
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
      load();
    } catch (e: any) {
      console.error('Unblock slot failed', e);
      const rawMessage = e?.response?.data?.message || e?.message || '';
      if (/already|not\s*found/i.test(String(rawMessage))) {
        toast.error('Slot is already unblocked or could not be found');
      } else {
        toast.error(rawMessage || 'Failed to unblock slot');
      }
    } finally {
      setIsUnblocking(false);
    }
  };

  const renderMobileFieldCard = (field: SportsField) => (
    <div key={field.id} className="bg-white border rounded-lg p-3 shadow-sm">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Field</div>
          <div className="text-sm font-semibold text-gray-900 truncate">{field.name}</div>
          <div className="text-xs text-gray-600 truncate">Type: {field.sport_type}</div>
          <div className="text-[10px] text-gray-400">ID: {field.id}</div>
        </div>
        <span
          className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${
            field.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {field.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-gray-700 mt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Capacity</div>
          <div className="mt-1 font-medium text-gray-900">{field.capacity}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Rate</div>
          <div className="mt-1 font-medium text-gray-900">R {Number(field.hourly_rate || 0).toFixed(2)}</div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(field)} className="flex-1 text-xs">
          Edit
        </Button>
        <Button
          size="sm"
          variant={field.is_active ? 'secondary' : 'primary'}
          onClick={() => toggleActive(field)}
          className="flex-1 text-xs"
        >
          {field.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-4 max-w-screen-xl">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fields Management</h1>
      </div>

      <Card className="mb-3">
        <CardContent className="px-3 py-2">
          <h2 className="text-sm font-semibold mb-2">{editing ? 'Edit Field' : 'Create Field'}</h2>
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

      <Card className="mb-3">
        <CardContent className="px-3 py-2">
          <h2 className="text-sm font-semibold mb-2">Block / Unblock Slot</h2>
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
          <div className="flex flex-col gap-3 mb-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:gap-3">
              <span className="text-gray-700 font-medium">Total: {displayFields.length} fields</span>
              <select
                className="input text-xs px-2 py-1 w-full sm:w-auto"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Sort:</span>
                <select
                  className="input text-xs px-2 py-1 w-full sm:w-auto"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="name">Name</option>
                  <option value="sport_type">Type</option>
                  <option value="capacity">Capacity</option>
                  <option value="hourly_rate">Rate</option>
                  <option value="is_active">Active</option>
                </select>
              </div>
              <select
                className="input text-xs px-2 py-1 w-full sm:w-auto"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as any)}
              >
                <option value="asc">↑</option>
                <option value="desc">↓</option>
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              disabled={loading}
              className="text-xs px-2 py-1 w-full md:w-auto"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <div>
              <div className="md:hidden space-y-3 -mx-1">
                {paginatedFields.map(renderMobileFieldCard)}
              </div>
              <div className="hidden md:block">
                <Table
                  data={paginatedFields}
                  keyExtractor={(f) => f.id.toString()}
                  columns={[
                  { key: 'id', title: 'ID', className: 'w-[8%]' },
                  { key: 'name', title: 'Name', className: 'w-[25%] truncate' },
                  { key: 'sport_type', title: 'Type', className: 'w-[15%] truncate' },
                  { key: 'capacity', title: 'Capacity', className: 'w-[12%]' },
                  { key: 'hourly_rate', title: 'Rate', className: 'w-[15%]', render: (v: number) => `R ${Number(v || 0).toFixed(2)}` },
                  { key: 'is_active', title: 'Status', className: 'w-[10%]', render: (v: boolean) => (
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      v ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {v ? 'Active' : 'Inactive'}
                    </span>
                  ) },
                  {
                    key: 'actions',
                    title: 'Actions',
                    className: 'w-[15%]',
                    render: (_: any, row: SportsField) => (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(row)} className="text-xs px-2 py-1">
                          Edit
                        </Button>
                        <Button size="sm" variant={row.is_active ? 'secondary' : 'primary'} onClick={() => toggleActive(row)} className="text-xs px-2 py-1">
                          {row.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    )
                  }
                ]}
                />
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-2">
                  <div className="text-xs text-gray-600">
                    Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, displayFields.length)} of {displayFields.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="text-xs px-2 py-1"
                    >
                      ««
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="text-xs px-2 py-1"
                    >
                      ‹
                    </Button>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {currentPage} of {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="text-xs px-2 py-1"
                    >
                      ›
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="text-xs px-2 py-1"
                    >
                      »»
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FieldsManagementPage;
