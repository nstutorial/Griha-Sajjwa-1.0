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
import { Users, DollarSign, Calendar, Plus, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Loan {
  id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'daily' | 'monthly' | 'none';
  loan_date: string;
  due_date?: string;
  is_active: boolean;
  customers: {
    name: string;
    phone?: string;
  };
}

interface LoanTransaction {
  id: string;
  amount: number;
  transaction_type: 'principal' | 'interest' | 'mixed';
  payment_date: string;
  notes?: string;
}

interface LoansListProps {
  onUpdate: () => void;
}

const LoansList: React.FC<LoansListProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);

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
          principal_amount,
          interest_rate,
          interest_type,
          loan_date,
          due_date,
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

  const calculateInterest = (loan: Loan): number => {
    if (loan.interest_type === 'none' || loan.interest_rate === 0) return 0;

    const loanDate = new Date(loan.loan_date);
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));

    if (loan.interest_type === 'daily') {
      return (loan.principal_amount * loan.interest_rate * daysDiff) / 100;
    } else if (loan.interest_type === 'monthly') {
      const monthsDiff = daysDiff / 30;
      return (loan.principal_amount * loan.interest_rate * monthsDiff) / 100;
    }

    return 0;
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
      fetchLoans();
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

  if (loading) {
    return <div>Loading loans...</div>;
  }

  if (loans.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No loans recorded yet. Create your first loan!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loans.map((loan) => {
        const interest = calculateInterest(loan);
        const totalAmount = loan.principal_amount + interest;
        
        return (
          <Card key={loan.id} className={`${!loan.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{loan.customers.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant={loan.is_active ? 'default' : 'secondary'}>
                    {loan.is_active ? 'Active' : 'Completed'}
                  </Badge>
                  <Badge variant="outline">
                    {loan.interest_type === 'none' ? 'No Interest' : 
                     `${loan.interest_rate}% ${loan.interest_type}`}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <p className="text-sm text-muted-foreground">Loan Date</p>
                  <p className="font-semibold">{new Date(loan.loan_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              {loan.is_active && (
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => showPayment(loan)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Payment
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => showLedger(loan)}>
                    <Eye className="h-4 w-4 mr-1" />
                    View Ledger
                  </Button>
                </div>
              )}
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
                    <p className="font-semibold text-orange-600">₹{calculateInterest(selectedLoan).toFixed(2)}</p>
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
    </div>
  );
};

export default LoansList;