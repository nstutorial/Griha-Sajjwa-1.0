import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, DollarSign, Calendar, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useControl } from '@/contexts/ControlContext';
import EditLoanDialog from './EditLoanDialog';

interface Loan {
  id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'daily' | 'monthly' | 'none';
  loan_date: string;
  due_date?: string;
  description?: string;
  is_active: boolean;
  customers: {
    name: string;
    phone?: string;
  };
}

interface LoanTransaction {
  id: string;
  loan_id: string;
  amount: number;
  transaction_type: 'principal' | 'interest' | 'mixed';
  payment_date: string;
  notes?: string;
}

interface LoansListProps {
  onUpdate: () => void;
  status?: 'active' | 'closed';
}

const LoansList: React.FC<LoansListProps> = ({ onUpdate, status = 'active' }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: controlSettings } = useControl();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [paymentData, setPaymentData] = useState({
    amount: '',
    type: 'mixed' as 'principal' | 'interest' | 'mixed',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          id,
          loan_number,
          principal_amount,
          interest_rate,
          interest_type,
          loan_date,
          due_date,
          description,
          is_active,
          customers (name, phone)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLoans((data as Loan[]) || []);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch loans",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (loanId: string) => {
    try {
      const { data, error } = await supabase
        .from('loan_transactions')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setTransactions((data as LoanTransaction[]) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch transactions",
      });
    }
  };

  const calculateLoanBalance = (loanId: string) => {
    const loanTransactions = transactions.filter(t => t.loan_id === loanId);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    const loan = loans.find(l => l.id === loanId);
    return loan ? loan.principal_amount - totalPaid : 0;
  };

  const calculateInterest = (loan: Loan, balance: number): number => {
    if (loan.interest_type === 'none' || loan.interest_rate === 0) return 0;

    const loanDate = new Date(loan.loan_date);
    const currentDate = new Date();
    const rate = loan.interest_rate / 100;

    if (loan.interest_type === 'daily') {
      // Daily interest calculation
      const timeDiff = currentDate.getTime() - loanDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      // Monthly interest calculation
      const months = (currentDate.getFullYear() - loanDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - loanDate.getMonth());
      const daysInMonth = (currentDate.getDate() - loanDate.getDate()) / 30; // Approximate partial month
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }

    return 0;
  };

  const calculateOutstandingAmount = (loan: Loan) => {
    const balance = calculateLoanBalance(loan.id);
    const interest = calculateInterest(loan, balance);
    return balance + interest;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    try {
      const { error } = await supabase
        .from('loan_transactions')
        .insert({
          loan_id: selectedLoan.id,
          amount: parseFloat(paymentData.amount),
          transaction_type: paymentData.type,
          notes: paymentData.notes || null,
        });

      if (error) throw error;

      toast({
        title: "Payment recorded",
        description: "The payment has been successfully recorded.",
      });

      setPaymentData({ amount: '', type: 'mixed', notes: '' });
      setShowPaymentDialog(false);
      await fetchLoans();
      await fetchTransactions(selectedLoan.id);
      onUpdate();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record payment",
      });
    }
  };

  const showLedger = async (loan: Loan) => {
    setSelectedLoan(loan);
    await fetchTransactions(loan.id);
    setShowLedgerDialog(true);
  };

  const showPayment = (loan: Loan) => {
    setSelectedLoan(loan);
    setShowPaymentDialog(true);
  };

  const handleEditLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setEditDialogOpen(true);
  };

  const handleQuickDelete = async (loan: Loan) => {
    if (!confirm(`Are you sure you want to delete loan #${loan.loan_number} for ${loan.customers.name}? This action cannot be undone.`)) return;

    try {
      // First delete related transactions
      await supabase
        .from('loan_transactions')
        .delete()
        .eq('loan_id', loan.id);

      // Then delete the loan
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loan.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Loan deleted successfully!",
      });

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete loan.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user && loans.length > 0) {
      const loanIds = loans.map(l => l.id);
      const fetchAllTransactions = async () => {
        const { data } = await supabase
          .from('loan_transactions')
          .select('*')
          .in('loan_id', loanIds);
        setTransactions((data as LoanTransaction[]) || []);
      };
      fetchAllTransactions();
    }
  }, [user, loans]);

  const filteredLoans = loans.filter(loan => {
    // Filter by status first
    const balance = calculateLoanBalance(loan.id);
    const interest = calculateInterest(loan, balance);
    const outstanding = balance + interest;
    const isClosed = outstanding <= 0;
    
    if (status === 'active' && isClosed) return false;
    if (status === 'closed' && !isClosed) return false;
    
    // Then filter by search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loan.customers.name.toLowerCase().includes(query) ||
      loan.loan_number?.toLowerCase().includes(query) ||
      loan.description?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <div>Loading loans...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by customer, loan ID, or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {filteredLoans.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery 
                ? 'No loans found matching your search.' 
                : status === 'closed' 
                  ? 'No closed loans yet.' 
                  : 'No active loans yet. Create your first loan!'}
            </p>
          </CardContent>
        </Card>
      )}

      {filteredLoans.map((loan) => {
        const balance = calculateLoanBalance(loan.id);
        const interest = calculateInterest(loan, balance);
        const outstanding = balance + interest;
        const totalAmount = loan.principal_amount + interest;
        const isClosed = outstanding <= 0;
        
        return (
          <Card key={loan.id} className={`${isClosed ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{loan.customers.name}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      #{loan.loan_number}
                    </Badge>
                  </div>
                  {loan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{loan.description}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={isClosed ? 'secondary' : 'default'}>
                    {isClosed ? 'Closed' : 'Active'}
                  </Badge>
                  <Badge variant="outline">
                    {loan.interest_type === 'none' ? 'No Interest' : 
                     `${loan.interest_rate}% ${loan.interest_type}`}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Principal</p>
                  <p className="font-semibold">₹{loan.principal_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interest</p>
                  <p className="font-semibold text-orange-600">₹{interest.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-primary">₹{totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className={`font-semibold ${isClosed ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{outstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Date</p>
                  <p className="font-semibold">{new Date(loan.loan_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex space-x-2 flex-wrap">
                {!isClosed && (
                  <>
                    <Button size="sm" onClick={() => showPayment(loan)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Payment
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => showLedger(loan)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View Ledger
                    </Button>
                  </>
                )}
                {controlSettings.allowEdit && (
                  <Button variant="outline" size="sm" onClick={() => handleEditLoan(loan)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {controlSettings.allowDelete && (
                  <Button variant="destructive" size="sm" onClick={() => handleQuickDelete(loan)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment - {selectedLoan?.customers.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount (₹)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                placeholder="Enter payment amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select 
                value={paymentData.type} 
                onValueChange={(value: any) => setPaymentData({ ...paymentData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal Only</SelectItem>
                  <SelectItem value="interest">Interest Only</SelectItem>
                  <SelectItem value="mixed">Mixed (Principal + Interest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Input
                id="payment-notes"
                placeholder="Add any notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full">
              Record Payment
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ledger Dialog */}
      <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ledger - {selectedLoan?.customers.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedLoan && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Principal Amount</p>
                    <p className="font-semibold">₹{selectedLoan.principal_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Interest</p>
                    <p className="font-semibold text-orange-600">
                      ₹{calculateInterest(selectedLoan, calculateLoanBalance(selectedLoan.id)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-center">No payments recorded yet.</p>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <p className="font-medium">₹{transaction.amount.toFixed(2)}</p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{transaction.transaction_type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(transaction.payment_date).toLocaleDateString()}
                        </span>
                      </div>
                      {transaction.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{transaction.notes}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Loan Dialog */}
      <EditLoanDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        loan={selectedLoan}
        onLoanUpdated={onUpdate}
      />
    </div>
  );
};

export default LoansList;
