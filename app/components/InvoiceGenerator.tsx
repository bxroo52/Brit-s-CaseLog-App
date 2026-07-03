'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function InvoiceGenerator() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const generateInvoice = async () => {
    if (!startDate || !endDate) {
      alert('Please select start and end dates');
      return;
    }

    if (!supabase) {
      alert('Supabase not configured');
      return;
    }

    setLoading(true);

    try {
      const { data: entries, error } = await supabase
        .from('time_entries')
        .select(`
          date,
          hours,
          rate,
          description,
          activity_type,
          cases (case_number, title, client_last_name, client_first_name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date');

      if (error) throw error;

      // Group by client/case
      const grouped: any = {};
      let grandTotal = 0;

      entries?.forEach((entry: any) => {
        const caseInfo = entry.cases;
        const clientKey = `${caseInfo?.client_last_name || ''}, ${caseInfo?.client_first_name || ''} - ${caseInfo?.case_number}`;

        if (!grouped[clientKey]) {
          grouped[clientKey] = {
            entries: [],
            totalHours: 0,
            totalAmount: 0,
          };
        }

        const amount = (entry.hours || 0) * (entry.rate || 50);
        grouped[clientKey].entries.push({
          Date: entry.date,
          Project: caseInfo?.title || '',
          'Project Code': caseInfo?.case_number || '',
          Task: entry.activity_type || '',
          Notes: entry.description || '',
          Hours: entry.hours,
          'Billable Rate': entry.rate || 50,
          'Billable Amount': amount,
        });

        grouped[clientKey].totalHours += entry.hours || 0;
        grouped[clientKey].totalAmount += amount;
        grandTotal += amount;
      });

      // Create Summary Sheet
      const summaryData: any[] = [
        ['Contractor Name', 'Brittany Ford'],
        ['Month & Year', new Date(startDate).toLocaleString('default', { month: 'long', year: 'numeric' })],
        [],
        ['Client Last Name', 'Client First Name', 'Case Number', 'Hours', 'Amount Billed', 'Expenses', 'Total', 'Type'],
      ];

      Object.keys(grouped).forEach(key => {
        const [last, first] = key.split(' - ')[0].split(', ');
        summaryData.push([
          last || '',
          first || '',
          key.split(' - ')[1] || '',
          '' + grouped[key].totalHours,
          '' + grouped[key].totalAmount,
          '' + 0,
          '' + grouped[key].totalAmount,
          'Time',
        ]);
      });

      summaryData.push(['', '', 'Total Hours', '', '' + grandTotal, '', '', '']);

      // Create Detailed Invoice Sheet
      const invoiceData: any[] = [['Date', 'Project', 'Project Code', 'Task', 'Notes', 'Hours', 'Billable Rate', 'Billable Amount']];

      Object.keys(grouped).forEach(key => {
        invoiceData.push([key, '', '', '', '', '', '', '']);
        grouped[key].entries.forEach((e: any) => invoiceData.push(Object.values(e)));
        invoiceData.push(['', '', '', '', 'SUBTOTAL', '' + grouped[key].totalHours, '', '' + grouped[key].totalAmount]);
        invoiceData.push([]);
      });

      invoiceData.push(['', '', '', '', 'GRAND TOTAL', '', '', '' + grandTotal]);

      // Generate Excel
      const wb = XLSX.utils.book_new();
      
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWS, 'Summary');

      const invoiceWS = XLSX.utils.aoa_to_sheet(invoiceData);
      XLSX.utils.book_append_sheet(wb, invoiceWS, 'Invoice');

      XLSX.writeFile(wb, `Caselog_Invoice_${startDate}_to_${endDate}.xlsx`);

      alert('Invoice & Summary generated successfully!');

    } catch (err) {
      console.error(err);
      alert('Error generating invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 rounded-2xl">
      <h2 className="text-2xl font-bold mb-6">Generate Invoice & Summary</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl" />
        </div>
        <div>
          <label className="block text-sm mb-1">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-zinc-800 p-3 rounded-xl" />
        </div>
      </div>

      <button 
        onClick={generateInvoice} 
        disabled={loading}
        className="w-full bg-white text-black py-4 rounded-2xl font-semibold disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate Invoice & Summary Excel'}
      </button>
    </div>
  );
}
