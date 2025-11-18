import React, { useEffect, useState } from 'react';
import fieldService from '../../services/fieldsService';
import type { SportsField } from '../../types';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Card, CardContent } from '../../components/ui/Card';
import toast from 'react-hot-toast';

const FieldsManagementPage: React.FC = () => {
  const [fields, setFields] = useState<SportsField[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fieldService.getAllFields(false);
      setFields(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (field: SportsField) => {
    try {
      if (field.is_active) {
        await fieldService.deactivateField(field.id);
        toast.success('Field deactivated');
      } else {
        await fieldService.activateField(field.id);
        toast.success('Field activated');
      }
      load();
    } catch {
      toast.error('Failed to update field status');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fields Management</h1>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : (
            <Table
              data={fields}
              keyExtractor={(f) => f.id.toString()}
              columns={[
                { key: 'id', title: 'ID' },
                { key: 'name', title: 'Name' },
                { key: 'sport_type', title: 'Type' },
                { key: 'capacity', title: 'Capacity' },
                { key: 'hourly_rate', title: 'Hourly Rate', render: (v: number) => `R ${v.toFixed(2)}` },
                { key: 'is_active', title: 'Active', render: (v: boolean) => v ? 'Yes' : 'No' },
                {
                  key: 'actions',
                  title: 'Actions',
                  render: (_: any, row: SportsField) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
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
