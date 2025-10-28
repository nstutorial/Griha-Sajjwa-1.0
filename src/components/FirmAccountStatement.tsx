import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  partner_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface FirmAccountStatementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

export function FirmAccountStatement({ 
  open, 
  onOpenChange, 
  accountId,
  accountName 
}: FirmAccountStatementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && accountId) {
      fetchTransactions();
    }
  }, [open, accountId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('firm_account_id', accountId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      partner_deposit: 'Partner Deposit',
      partner_withdrawal: 'Partner Withdrawal',
      expense: 'Expense',
      income: 'Income',
      adjustment: 'Adjustment'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Statement - {accountName}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="text-center py-8">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found for this account
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {format(new Date(transaction.transaction_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {getTransactionTypeLabel(transaction.transaction_type)}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {transaction.description || '-'}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${
                    transaction.transaction_type === 'partner_withdrawal' || 
                    transaction.transaction_type === 'expense' 
                      ? 'text-destructive' 
                      : 'text-green-600'
                  }`}>
                    {transaction.transaction_type === 'partner_withdrawal' || 
                     transaction.transaction_type === 'expense' 
                      ? '-' 
                      : '+'}
                    ₹{transaction.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
