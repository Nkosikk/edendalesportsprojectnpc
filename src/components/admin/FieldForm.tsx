import { useState } from 'react';
import type { CreateFieldRequest, SportsField } from '../../types';
import fieldService from '../../services/fieldsService';
import Button from '../ui/Button';
import toast from 'react-hot-toast';

interface FieldFormProps {
  onCreated?: (field: SportsField) => void;
  onUpdated?: (field: SportsField) => void;
  editingField?: SportsField | null;
  onCancelEdit?: () => void;
}

const initialState: CreateFieldRequest = {
  name: '',
  description: '',
  sport_type: 'multipurpose',
  capacity: 0,
  hourly_rate: 400,
  facilities: '',
  rules: '',
};

const FieldForm = ({ onCreated, onUpdated, editingField, onCancelEdit }: FieldFormProps) => {
  const [form, setForm] = useState<CreateFieldRequest>(editingField ? {
    name: editingField.name,
    description: editingField.description || '',
    sport_type: editingField.sport_type,
    capacity: editingField.capacity,
    hourly_rate: editingField.hourly_rate,
    facilities: editingField.facilities,
    rules: editingField.rules || '',
  } : initialState);
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof CreateFieldRequest, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const validateFieldName = (name: string): string | null => {
    if (!name.trim()) return 'Field name is required';
    if (name.length < 2) return 'Field name must be at least 2 characters';
    if (name.length > 50) return 'Field name must be less than 50 characters';
    // Allow alphanumeric, spaces, hyphens, dots, apostrophes, and parentheses
    const validPattern = /^[a-zA-Z0-9\s\-\.\'\(\)]+$/;
    if (!validPattern.test(name)) {
      return 'Field name can only contain letters, numbers, spaces, hyphens, dots, apostrophes, and parentheses';
    }
    return null;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate field name
      const nameError = validateFieldName(form.name);
      if (nameError) {
        toast.error(nameError);
        return;
      }

      if (editingField) {
        const updated = await fieldService.updateField(editingField.id, form);
        toast.success('Field updated');
        onUpdated && onUpdated(updated);
      } else {
        const created = await fieldService.createField(form);
        console.log('Field created:', created);
        toast.success(`Field created${created.is_active ? ' and activated' : ' (inactive - activate to show in availability)'}`);
        setForm(initialState);
        onCreated && onCreated(created);
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2">
          <label className="label-compact text-gray-700">Name</label>
          <input className="input input-compact" value={form.name} onChange={e => updateField('name', e.target.value)} />
        </div>
        <div>
          <label className="label-compact text-gray-700">Sport Type</label>
          <select className="input input-compact" value={form.sport_type} onChange={e => updateField('sport_type', e.target.value)}>
            {['football','netball','basketball','tennis','multipurpose'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-compact text-gray-700">Capacity</label>
          <input type="number" className="input input-compact" value={form.capacity} onChange={e => updateField('capacity', Number(e.target.value))} />
        </div>
        <div>
          <label className="label-compact text-gray-700">Hourly Rate (R)</label>
          <input type="number" className="input input-compact" value={form.hourly_rate} onChange={e => updateField('hourly_rate', Number(e.target.value))} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="label-compact text-gray-700">Facilities</label>
          <input className="input input-compact" value={form.facilities} onChange={e => updateField('facilities', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="label-compact text-gray-700">Description</label>
          <textarea rows={2} className="input input-compact" value={form.description} onChange={e => updateField('description', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="label-compact text-gray-700">Rules</label>
          <textarea rows={2} className="input input-compact" value={form.rules} onChange={e => updateField('rules', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={loading} onClick={handleSubmit}>{editingField ? 'Update Field' : 'Create Field'}</Button>
        {editingField && (
          <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
        )}
      </div>
    </div>
  );
};

export default FieldForm;
