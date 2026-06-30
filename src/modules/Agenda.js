// --- Ajanda & Hatırlatıcılar ---
import React, { useState, useMemo } from 'react';
import { Trash2, CheckCircle2, Circle, CalendarClock, Bell } from 'lucide-react';
import { addRecord, updateRecord, deleteRecord, Timestamp } from '../firebase';
import { formatDate, todayInput, daysBetween } from '../utils';
import { PageHeader, AddButton, Card, EmptyState, StatCard, FormModal, Field, Input, Textarea, Select, Badge } from '../components/ui';

function ReminderForm({ userId, onClose }) {
  const [form, setForm] = useState({ title: '', date: todayInput(), priority: 'normal', note: '' });
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    await addRecord(userId, 'reminders', { ...form, done: false, date: Timestamp.fromDate(new Date(form.date)) });
    onClose();
  };
  return (
    <FormModal title="Yeni Hatırlatıcı" onSubmit={submit} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Başlık"><Input name="title" value={form.title} onChange={set} required /></Field>
        <Field label="Tarih"><Input type="date" name="date" value={form.date} onChange={set} /></Field>
        <Field label="Öncelik"><Select name="priority" value={form.priority} onChange={set}><option value="low">Düşük</option><option value="normal">Normal</option><option value="high">Yüksek</option></Select></Field>
        <Field label="Not"><Textarea name="note" value={form.note} onChange={set} /></Field>
      </div>
    </FormModal>
  );
}

const prio = { high: { c: 'red', l: 'Yüksek' }, normal: { c: 'blue', l: 'Normal' }, low: { c: 'gray', l: 'Düşük' } };

export default function Agenda({ data, userId }) {
  const { reminders = [] } = data;
  const [formOpen, setFormOpen] = useState(false);

  const sorted = useMemo(
    () => [...reminders].sort((a, b) => (a.done === b.done ? (a.date?.seconds || 0) - (b.date?.seconds || 0) : a.done ? 1 : -1)),
    [reminders]
  );
  const pending = reminders.filter((r) => !r.done);
  const overdue = pending.filter((r) => daysBetween(new Date(), r.date) < 0).length;

  return (
    <div>
      <PageHeader title="Ajanda" subtitle="Görev ve hatırlatıcılarınız">
        <AddButton label="Yeni Hatırlatıcı" onClick={() => setFormOpen(true)} />
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Toplam" value={reminders.length} icon={CalendarClock} color="text-orange-600" />
        <StatCard title="Bekleyen" value={pending.length} icon={Bell} color="text-yellow-600" />
        <StatCard title="Geciken" value={overdue} color="text-red-600" />
      </div>

      <Card>
        {sorted.length === 0 ? <EmptyState message="Henüz hatırlatıcı yok" /> : (
          <div className="divide-y divide-gray-100">
            {sorted.map((r) => {
              const p = prio[r.priority] || prio.normal;
              const late = !r.done && daysBetween(new Date(), r.date) < 0;
              return (
                <div key={r.id} className="flex items-start gap-3 p-4 hover:bg-gray-50">
                  <button onClick={() => updateRecord(userId, 'reminders', r.id, { done: !r.done })} className="mt-0.5 text-gray-400 hover:text-green-600">
                    {r.done ? <CheckCircle2 size={20} className="text-green-600" /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${r.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{r.title}</span>
                      <Badge color={p.c}>{p.l}</Badge>
                      {late && <Badge color="red">Gecikti</Badge>}
                    </div>
                    {r.note && <p className="text-sm text-gray-500 mt-1">{r.note}</p>}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(r.date)}</p>
                  </div>
                  <button onClick={() => deleteRecord(userId, 'reminders', r.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {formOpen && <ReminderForm userId={userId} onClose={() => setFormOpen(false)} />}
    </div>
  );
}
