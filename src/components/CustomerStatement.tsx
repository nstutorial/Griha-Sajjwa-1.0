import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Calendar, IndianRupee, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  payment_day: string | null;
}

interface Loan {
  id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate: number | null;
  interest_type: string | null;
  loan_date: string;
  due_date: string | null;
  description: string | null;
  is_active: boolean | null;
}

interface LoanTransaction {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  transaction_type: string;
  notes: string | null;
  loan: {
    loan_number: string;
    description: string | null;
  };
}

interface StatementEntry {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'loan_disbursement' | 'payment_received' | 'interest_accrued';
}

interface CustomerStatementProps {
  customer: Customer;
}

const CustomerStatement: React.FC<CustomerStatementProps> = ({ customer }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCustomerData();
    }
  }, [user, customer.id]);

  useEffect(() => {
    if (loans.length > 0 && transactions.length > 0) {
      generateStatement();
    }
  }, [loans, transactions, startDate, endDate]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      // Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from('loans')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('user_id', user?.id)
        .order('loan_date', { ascending: false });

      if (loansError) throw loansError;
      setLoans(loansData || []);

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select(`
          *,
          loan:loans(loan_number, description)
        `)
        .in('loan_id', (loansData || []).map(l => l.id))
        .order('payment_date', { ascending: true });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);

    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch customer data",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateStatement = () => {
    const statementEntries: StatementEntry[] = [];
    let runningBalance = 0;

    // Collect all entries first
    const allEntries: StatementEntry[] = [];

    // Add loan disbursements
    loans.forEach(loan => {
      const loanDate = new Date(loan.loan_date);
      const isInRange = (!startDate || loanDate >= new Date(startDate)) && 
                       (!endDate || loanDate <= new Date(endDate));

      if (isInRange) {
        allEntries.push({
          date: loan.loan_date,
          // description: `Loan - ${loan.description || 'Loan'} (${loan.loan_number})`,
           description: `Loan - ${loan.description`,
          reference: loan.loan_number,
          debit: loan.principal_amount,
          credit: 0,
          balance: 0, // Will be calculated after sorting
          type: 'loan_disbursement'
        });
      }
    });

    // Add payments received
    transactions.forEach(transaction => {
      const paymentDate = new Date(transaction.payment_date);
      const isInRange = (!startDate || paymentDate >= new Date(startDate)) && 
                       (!endDate || paymentDate <= new Date(endDate));

      if (isInRange) {
        allEntries.push({
          date: transaction.payment_date,
          description: `Payment Received - ${transaction.loan.description || 'Loan'} (${transaction.loan.loan_number})`,
          reference: transaction.id,
          debit: 0,
          credit: transaction.amount,
          balance: 0, // Will be calculated after sorting
          type: 'payment_received'
        });
      }
    });

    // Sort by date in ascending order
    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance in chronological order
    allEntries.forEach(entry => {
      if (entry.type === 'loan_disbursement') {
        entry.balance = runningBalance + entry.debit;
        runningBalance += entry.debit;
      } else if (entry.type === 'payment_received') {
        entry.balance = runningBalance - entry.credit;
        runningBalance -= entry.credit;
      }
      statementEntries.push(entry);
    });

    setStatement(statementEntries);
  };

  const calculateLoanBalance = (loanId: string) => {
    const loanTransactions = transactions.filter(t => t.loan_id === loanId);
    const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
    const loan = loans.find(l => l.id === loanId);
    return loan ? loan.principal_amount - totalPaid : 0;
  };

  const calculateInterest = (loan: Loan, balance: number) => {
    if (!loan.interest_rate || loan.interest_type === 'none') return 0;
    
    const rate = loan.interest_rate / 100;
    const startDate = new Date(loan.loan_date);
    const endDate = new Date();
    
    if (loan.interest_type === 'daily') {
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      return balance * rate * (daysDiff / 365);
    } else if (loan.interest_type === 'monthly') {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                     (endDate.getMonth() - startDate.getMonth());
      const daysInMonth = (endDate.getDate() - startDate.getDate()) / 30;
      const totalMonths = months + daysInMonth;
      return balance * rate * totalMonths;
    }
    
    return 0;
  };

  const calculateTotalOutstanding = () => {
    return loans.reduce((sum, loan) => {
      const balance = calculateLoanBalance(loan.id);
      const interest = calculateInterest(loan, balance);
      return sum + balance + interest;
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const exportToPDF = () => {
    // Simple HTML to PDF conversion
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Customer Statement - ${customer.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .customer-info { margin-bottom: 20px; }
            .statement-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .statement-table th, .statement-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .statement-table th { background-color: #f2f2f2; }
            .debit { color: red; }
            .credit { color: green; }
            .balance { font-weight: bold; }
            .summary { margin-top: 30px; padding: 20px; background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Customer Statement</h1>
            <h2>${customer.name}</h2>
          </div>
          
          <div class="customer-info">
            <p><strong>Customer:</strong> ${customer.name}</p>
            <p><strong>Phone:</strong> ${customer.phone || 'N/A'}</p>
            <p><strong>Address:</strong> ${customer.address || 'N/A'}</p>
            <p><strong>Statement Period:</strong> ${startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'All'} - ${endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Current'}</p>
          </div>

          <table class="statement-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${statement.map(entry => `
                <tr>
                  <td>${format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                  <td>${entry.description}</td>
                  <td>${entry.reference}</td>
                  <td class="debit">${entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                  <td class="credit">${entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                  <td class="balance">${formatCurrency(entry.balance)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3>Account Summary</h3>
            <p><strong>Total Outstanding Balance:</strong> ${formatCurrency(calculateTotalOutstanding())}</p>
            <p><strong>Total Transactions:</strong> ${statement.length}</p>
          </div>
        </body>
        </html>
      `;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Statement Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Customer Statement</CardTitle>
            </div>
            <Button onClick={exportToPDF} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="start-date">From Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">To Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{loans.length}</div>
              <div className="text-sm text-blue-600">Total Loans</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{transactions.length}</div>
              <div className="text-sm text-green-600">Total Payments</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(calculateTotalOutstanding())}</div>
              <div className="text-sm text-orange-600">Outstanding Balance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statement Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Statement</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading statement...</div>
          ) : statement.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium">Reference</th>
                    <th className="text-right p-3 font-medium">Debit</th>
                    <th className="text-right p-3 font-medium">Credit</th>
                    <th className="text-right p-3 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((entry, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">{format(new Date(entry.date), 'dd/MM/yyyy')}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{entry.description}</span>
                          <Badge 
                            variant={
                              entry.type === 'loan_disbursement' ? 'destructive' :
                              entry.type === 'payment_received' ? 'default' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {entry.type === 'loan_disbursement' ? 'Loan' :
                             entry.type === 'payment_received' ? 'Payment' : 'Interest'}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">{entry.reference}</td>
                      <td className="p-3 text-right">
                        {entry.debit > 0 ? (
                          <span className="text-red-600 font-medium">{formatCurrency(entry.debit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {entry.credit > 0 ? (
                          <span className="text-green-600 font-medium">{formatCurrency(entry.credit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(entry.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerStatement;
