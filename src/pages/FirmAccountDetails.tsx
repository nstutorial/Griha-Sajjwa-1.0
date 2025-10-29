import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useControl } from '@/contexts/ControlContext';
import { EditFirmTransactionDialog } from '@/components/EditFirmTransactionDialog';

interface FirmAccount {
  id: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  current_balance: number;
  account_number: string | null;
  bank_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  partner_id: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export default function FirmAccountDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useControl();
  const [account, setAccount] = useState<FirmAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (id) {
      fetchAccountDetails();
      fetchTransactions();
    }
  }, [id]);

  const fetchAccountDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAccount(data);
    } catch (error: any) {
      console.error('Error fetching account:', error);
      toast.error('Failed to load account details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('firm_transactions')
        .select('*')
        .eq('firm_account_id', id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    if (!settings.allowEdit) {
      toast.error('Edit permission denied');
      return;
    }
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!settings.allowDelete) {
      toast.error('Delete permission denied');
      return;
    }

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('firm_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      toast.success('Transaction deleted');
      fetchTransactions();
      fetchAccountDetails();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      toast.error('Failed to delete transaction');
    }
  };

  const handleTransactionUpdated = () => {
    fetchTransactions();
    fetchAccountDetails();
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

  if (loading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!account) {
    return <div className="container mx-auto p-6">Account not found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/firm-accounts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Account Statement - {account.account_name}</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{account.account_type}</p>
            </div>
            {account.account_type === 'bank' && (
              <>
                {account.bank_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bank</p>
                    <p className="font-medium">{account.bank_name}</p>
                  </div>
                )}
                {account.account_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-medium">{account.account_number}</p>
                  </div>
                )}
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="font-medium">₹{account.opening_balance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-bold text-lg">₹{account.current_balance.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
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
                  {(settings.allowEdit || settings.allowDelete) && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
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
                    {(settings.allowEdit || settings.allowDelete) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {settings.allowEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTransaction(transaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {settings.allowDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTransaction(transaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditFirmTransactionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        transaction={selectedTransaction}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </div>
  );
}
