import apiClient, { handleApiResponse } from '../lib/api';
import type {
  SportsField,
  FieldAvailability,
  CreateFieldRequest,
  ApiResponse,
} from '../types';
import { normalizeTimeHM } from '../utils/scheduling';

// Normalize backend field payloads to strict frontend types
const normalizeField = (f: any): SportsField => {
  const hourly = f.hourly_rate ?? f.rate ?? 0;
  const sport = f.sport_type ?? f.field_type ?? 'multipurpose';
  const isActiveRaw = (f.is_active ?? f.active ?? f.enabled);
  const isActive = isActiveRaw === true || isActiveRaw === 1 || isActiveRaw === '1';
  return {
    id: Number(f.id),
    name: String(f.name ?? ''),
    description: f.description ?? '',
    sport_type: sport as SportsField['sport_type'],
    capacity: Number(f.capacity ?? 0),
    hourly_rate: Number(hourly),
    facilities: f.facilities ?? '',
    rules: f.rules ?? '',
    is_active: Boolean(isActive),
    created_at: f.created_at ?? new Date().toISOString(),
    updated_at: f.updated_at ?? f.created_at ?? new Date().toISOString(),
  };
};

/**
 * Sports Field Service
 * Handles field management and availability checking
 */

const normalizeAvailabilityPayload = (
  payload: any,
  fieldFallback: { fieldId: number; date: string; duration: number }
): FieldAvailability => {
  const fld = payload?.field || {};
  const hourly = fld.hourly_rate ?? fld.rate ?? 0;
  const st = fld.sport_type ?? fld.field_type ?? 'multipurpose';

  const toBool = (v: any) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
  const num = (v: any, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

  const slotsSrc: any[] = Array.isArray(payload?.slots) ? payload.slots : [];
  const slots = slotsSrc.map((s) => ({
    start_time: normalizeTimeHM(String(s.start_time ?? s.start ?? '')),
    end_time: normalizeTimeHM(String(s.end_time ?? s.end ?? '')),
    available: toBool(s.available ?? s.is_available ?? s.free ?? true),
    price: num(s.price ?? s.amount ?? hourly),
  }));

  const blockedSrc: any[] = Array.isArray(payload?.blocked_slots)
    ? payload.blocked_slots
    : Array.isArray(payload?.blocked)
    ? payload.blocked
    : [];
  const blocked_slots = blockedSrc.map((b) => ({
    start_time: normalizeTimeHM(String(b.start_time ?? b.start ?? '')),
    end_time: normalizeTimeHM(String(b.end_time ?? b.end ?? '')),
    status: (b.status ?? 'blocked') as 'blocked' | 'maintenance' | 'event',
    reason: b.reason ?? undefined,
  }));

  return {
    field: {
      id: Number(fld.id ?? fieldFallback.fieldId),
      name: String(fld.name ?? ''),
      field_type: st,
      hourly_rate: num(hourly),
    },
    date: String(payload?.date ?? fieldFallback.date),
    duration_hours: num(payload?.duration_hours ?? fieldFallback.duration),
    operating_hours: {
      start_time: normalizeTimeHM(
        String(payload?.operating_hours?.start_time ?? payload?.operating_start ?? '16:00')
      ),
      end_time: normalizeTimeHM(
        String(payload?.operating_hours?.end_time ?? payload?.operating_end ?? '22:00')
      ),
    },
    slots,
    blocked_slots,
  };
};

const fetchAvailabilityInternal = async (
  fieldId: number,
  date: string,
  duration: number
): Promise<FieldAvailability> => {
  const response = await apiClient.get<ApiResponse<FieldAvailability | any>>(
    `/fields/${fieldId}/availability`,
    {
      params: { date, duration },
    }
  );
  const raw = handleApiResponse<any>(response, false);
  const payload = raw?.availability || raw?.data || raw;
  return normalizeAvailabilityPayload(payload, { fieldId, date, duration });
};

export const fieldService = {
  /**
   * Get all sports fields
   */
  getAllFields: async (activeOnly = true): Promise<SportsField[]> => {
    // Backward-compatible wrapper: true -> active, false -> all
    return fieldService.getFields(activeOnly ? 'active' : 'all');
  },

  /**
   * Get fields by status
   * - 'active': active_only=1
   * - 'inactive': active_only=0  
   * - 'all': active_only=false (for admin to see both active and inactive)
   */
  getFields: async (status: 'all' | 'active' | 'inactive'): Promise<SportsField[]> => {
    const params: any = {};
    if (status === 'active') params.active_only = 1;
    if (status === 'inactive') params.active_only = 0;
    if (status === 'all') params.active_only = false;
    params._ts = Date.now();
    const response = await apiClient.get<ApiResponse<SportsField[]>>('/fields', { params });
    const payload = handleApiResponse<any>(response, false);
    const list = Array.isArray(payload) ? payload : (payload?.data || payload?.fields || []);
    return (list as any[]).map(normalizeField);
  },

  /**
   * Get field by ID
   */
  getFieldById: async (id: number): Promise<SportsField> => {
    const response = await apiClient.get<ApiResponse<SportsField>>(`/fields/${id}`);
    const data = handleApiResponse<any>(response, false);
    return normalizeField(Array.isArray(data) ? data[0] : (data?.field || data));
  },

  /**
   * Get field availability for a specific date
   */
  getFieldAvailability: async (
    fieldId: number,
    date: string,
    duration = 1
  ): Promise<FieldAvailability> => {
    const primary = await fetchAvailabilityInternal(fieldId, date, duration);

    if (duration <= 1) {
      return primary;
    }

    try {
      const baseline = await fetchAvailabilityInternal(fieldId, date, 1);

      const slotMap = new Map<string, { start_time: string; end_time: string; available: boolean; price: number }>();
      primary.slots.forEach((slot) => {
        const key = `${slot.start_time}-${slot.end_time}`;
        slotMap.set(key, { ...slot });
      });

      baseline.slots.forEach((slot) => {
        const key = `${slot.start_time}-${slot.end_time}`;
        const existing = slotMap.get(key);
        if (existing) {
          if (!slot.available) existing.available = false;
          if (!existing.price && slot.price) existing.price = slot.price;
        } else {
          slotMap.set(key, { ...slot });
        }
      });

      const mergedSlots = Array.from(slotMap.values()).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );

      const blockedKey = (slot: { start_time: string; end_time: string }) => `${slot.start_time}-${slot.end_time}`;
      const primaryBlocked = Array.isArray(primary.blocked_slots) ? primary.blocked_slots : [];
      const baselineBlocked = Array.isArray(baseline.blocked_slots) ? baseline.blocked_slots : [];
      const blockedSet = new Set(primaryBlocked.map(blockedKey));
      baselineBlocked.forEach((slot) => {
        const key = blockedKey(slot);
        if (!blockedSet.has(key)) {
          primaryBlocked.push(slot);
        }
      });

      primary.blocked_slots = primaryBlocked;

      primary.slots = mergedSlots;
    } catch (error) {
      console.warn('fieldService.getFieldAvailability: unable to merge baseline availability', error);
    }

    return primary;
  },

  /**
   * Create a new field (Admin only)
   */
  createField: async (data: CreateFieldRequest): Promise<SportsField> => {
    const response = await apiClient.post<ApiResponse<SportsField>>('/fields', data);
    const created = handleApiResponse<any>(response, false);
    return normalizeField(created?.field || created);
  },

  /**
   * Update a field (Admin only)
   */
  updateField: async (id: number, data: Partial<CreateFieldRequest>): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}`, data);
    const updated = handleApiResponse<any>(response, false);
    return normalizeField(updated?.field || updated);
  },

  /**
   * Delete/deactivate a field (Admin only)
   */
  deleteField: async (id: number): Promise<void> => {
    const response = await apiClient.delete<ApiResponse>(`/fields/${id}`);
    return handleApiResponse<void>(response, true); // Show success for field deletion
  },

  /**
   * Activate a field (Admin only)
   */
  activateField: async (id: number): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}/activate`, {}, {
      suppressErrorToast: true,
    } as any);
    const activated = handleApiResponse<any>(response);
    return normalizeField(activated?.field || activated);
  },

  /**
   * Deactivate a field (Admin only)
   */
  deactivateField: async (id: number): Promise<SportsField> => {
    const response = await apiClient.put<ApiResponse<SportsField>>(`/fields/${id}/deactivate`, {}, {
      suppressErrorToast: true,
    } as any);
    const deactivated = handleApiResponse<any>(response);
    return normalizeField(deactivated?.field || deactivated);
  },
};

export default fieldService;
