import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface StatementEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface SaleCustomerStatementProps {
  customerId: string;
}

const SaleCustomerStatement = ({ customerId }: SaleCustomerStatementProps) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (user && customerId) {
      fetchStatement();
    }
  }, [user, customerId]);

  const fetchStatement = async () => {
    if (!user) return;

    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .eq('user_id', user.id)
      .single();

    if (customer) {
      setCustomerName(customer.name);
    }

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', customerId)
      .eq('user_id', user.id)
      .order('sale_date');

    const { data: transactions } = await supabase
      .from('sale_transactions')
      .select(`
        *,
        sale:sales!inner(customer_id, user_id)
      `)
      .eq('sale.customer_id', customerId)
      .eq('sale.user_id', user.id)
      .order('payment_date');

    const allEntries: StatementEntry[] = [];
    let balance = 0;

    (sales || []).forEach((sale) => {
      balance += Number(sale.sale_amount);
      allEntries.push({
        date: sale.sale_date,
        description: `Sale - ${sale.sale_description}`,
        debit: sale.sale_amount,
        credit: 0,
        balance,
      });
    });

    (transactions || []).forEach((trans) => {
      balance -= Number(trans.amount);
      allEntries.push({
        date: trans.payment_date,
        description: `Payment${trans.notes ? ` - ${trans.notes}` : ''}`,
        debit: 0,
        credit: trans.amount,
        balance,
      });
    });

    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    allEntries.forEach((entry) => {
      runningBalance += entry.debit - entry.credit;
      entry.balance = runningBalance;
    });

    setEntries(allEntries);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-bold">{customerName}</h2>
          <p className="text-muted-foreground">Sale Statement</p>
        </div>
        <Button onClick={handlePrint}>
          <Download className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit (₹)</TableHead>
              <TableHead className="text-right">Credit (₹)</TableHead>
              <TableHead className="text-right">Balance (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={index}>
                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell className="text-right">
                  {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {entry.balance.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default SaleCustomerStatement;
