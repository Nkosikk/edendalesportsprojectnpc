// Simple audit trail placeholder utility
// Replace with persistence (API / external log) in production
export interface AuditEvent {
  action: string;
  entity?: string;
  entityId?: number | string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export const logAudit = (event: Omit<AuditEvent, 'timestamp'>) => {
  const payload: AuditEvent = { ...event, timestamp: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.info('[AUDIT]', JSON.stringify(payload));
};
