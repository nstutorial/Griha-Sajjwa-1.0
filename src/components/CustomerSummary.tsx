import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Download, Filter } from 'lucide-react';

interface CustomerSummaryData {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  total_loans: number;
  active_loans: number;
  total_loaned_amount: number;
  total_paid_amount: number;
  outstanding_balance: number;
  last_payment_date?: string;
  avg_payment_amount: number;
  payment_frequency: number;
}

const CustomerSummary: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summaryData, setSummaryData] = useState<CustomerSummaryData[]>([]);

  useEffect(() => {
    if (user) {
      // Set default date range to current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setDateFrom(firstDay.toISOString().split('T')[0]);
      setDateTo(lastDay.toISOString().split('T')[0]);
      
      fetchSummaryData(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0]);
    }
  }, [user]);

  const fetchSummaryData = async (fromDate?: string, toDate?: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const startDate = fromDate || dateFrom;
      const endDate = toDate || dateTo;

      // Fetch all customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('user_id', user.id);

      if (customersError) throw customersError;

      // Fetch loan data within date range
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          customer_id,
          principal_amount,
          loan_date,
          is_active,
          customers!inner(id, name, phone)
        `)
        .eq('user_id', user.id)
        .gte('loan_date', `${startDate}T00:00:00.000Z`)
        .lte('loan_date', `${endDate}T23:59:59.999Z`);

      if (loansError) throw loansError;

      // Fetch loan transactions within date range
      const loanIds = loans?.map(loan => loan.id) || [];
      const { data: transactions, error: transactionsError } = await supabase
        .from('loan_transactions')
        .select(`
          id,
          loan_id,
          amount,
          payment_date,
          loan:loans!inner(customer_id)
        `)
        .in('loan_id', loanIds)
        .gte('payment_date', `${startDate}T00:00:00.000Z`)
        .lte('payment_date', `${endDate}T23:59:59.999Z`);

      if (transactionsError) throw transactionsError;

      // Process data to create summary
      const summaryMap = new Map<string, CustomerSummaryData>();

      // Initialize customer entries
      customers?.forEach(customer => {
        summaryMap.set(customer.id, {
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone || undefined,
          total_loans: 0,
          active_loans: 0,
          total_loaned_amount: 0,
          total_paid_amount: 0,
          outstanding_balance: 0,
          last_payment_date: undefined,
          avg_payment_amount: 0,
          payment_frequency: 0,
        });
      });

      // Process loan transactions
      transactions?.forEach((transaction) => {
        const loanId = transaction.loan_id;
        const loan = loans?.find(loan => loan.id === loanId);
        if (!loan) return;

        const customerId = loan.customer_id;
        const summary = summaryMap.get(customerId);
        if (!summary) return;

        summary.total_paid_amount += transaction.amount;
        summary.payment_frequency += 1;
        
        const paymentDate = new Date(transaction.payment_date);
        if (!summary.last_payment_date || paymentDate > new Date(summary.last_payment_date)) {
          summary.last_payment_date = transaction.payment_date;
        }
      });      

      // Process loans
      loans?.forEach((loan) => {
        const customerId = loan.customer_id;
        const summary = summaryMap.get(customerId);
        if (!summary) return;

        summary.total_loans += 1;
        summary.total_loaned_amount += loan.principal_amount;
        if (loan.is_active) {
          summary.active_loans += 1;
        }

        // Calculate outstanding balance (simplified - principal - payments)
        const loanTransactions = transactions?.filter(t => t.loan_id === loan.id) || [];
        const totalPaid = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
        summary.outstanding_balance += Math.max(0, loan.principal_amount - totalPaid);
      });

      // Calculate averages and finalize data
      const finalSummary: CustomerSummaryData[] = Array.from(summaryMap.values()).map(summary => {
        summary.avg_payment_amount = summary.payment_frequency > 0 
          ? summary.total_paid_amount / summary.payment_frequency 
          : 0;
        
        // Only include customers with activity in the date range
        if (summary.total_loans > 0 || summary.total_paid_amount > 0) {
          return summary;
        }
        return null;
      }).filter(Boolean) as CustomerSummaryData[];

      // Filter customers who have loans in the selected date range
      const customersWithLoans = loans?.map(loan => loan.customer_id) || [];
      const finalSummaryFiltered = finalSummary
        .filter(summary => customersWithLoans.includes(summary.customer_id))
        .sort((a, b) => b.outstanding_balance - a.outstanding_balance);

      setSummaryData(finalSummaryFiltered);
    } catch (error) {
      console.error('Error fetching summary data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customer summary data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchSummaryData(dateFrom, dateTo);
  };

  const exportToCSV = () => {
    const csvContent = [
      // Headers
      [
        'Customer Name',
        'Phone',
        'Total Loans',
        'Active Loans',
        'Total Loaned',
        'Total Paid',
        'Outstanding Balance',
        'Last Payment',
        'Avg Payment',
        'Payment Count'
      ].join(','),
      // Data rows
      ...summaryData.map(summary => [
        summary.customer_name,
        summary.customer_phone || '',
        summary.total_loans,
        summary.active_loans,
        summary.total_loaned_amount.toFixed(2),
        summary.total_paid_amount.toFixed(2),
        summary.outstanding_balance.toFixed(2),
        summary.last_payment_date ? new Date(summary.last_payment_date).toLocaleDateString() : '',
        summary.avg_payment_amount.toFixed(2),
        summary.payment_frequency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-summary-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Customer summary data exported to CSV',
    });
  };

  const totalLoaned = summaryData.reduce((sum, item) => sum + item.total_loaned_amount, 0);
  const totalPaid = summaryData.reduce((sum, item) => sum + item.total_paid_amount, 0);
  const totalOutstanding = summaryData.reduce((sum, item) => sum + item.outstanding_balance, 0);
  const activeLoanCount = summaryData.reduce((sum, item) => sum + item.active_loans, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Customer Summary</h3>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading customer summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Customer Summary</h3>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilter} className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing loans and payments from {new Date(dateFrom).toLocaleDateString()} to {new Date(dateTo).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Loaned</div>
            <div className="text-2xl font-bold text-blue-600">₹{totalLoaned.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Received</div>
            <div className="text-2xl font-bold text-green-600">₹{totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-2xl font-bold text-orange-600">₹{totalOutstanding.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Active Loans</div>
            <div className="text-2xl font-bold text-purple-600">{activeLoanCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer-wise Loans & Payments Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No customer activity found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total Loans</TableHead>
                    <TableHead className="text-right">Active Loans</TableHead>
                    <TableHead className="text-right">Total Loaned</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead className="text-right">Avg Payment</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.map((customer) => (
                    <TableRow key={customer.customer_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.customer_name}</div>
                          {customer.customer_phone && (
                            <div className="text-sm text-muted-foreground">{customer.customer_phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{customer.total_loans}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={customer.active_loans > 0 ? "default" : "secondary"}>
                          {customer.active_loans}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        ₹{customer.total_loaned_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ₹{customer.total_paid_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-orange-600">
                        ₹{customer.outstanding_balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {customer.last_payment_date ? (
                          <span className="text-sm">
                            {new Date(customer.last_payment_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No payments</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={customer.avg_payment_amount > 0 ? "text-sm" : "text-sm text-muted-foreground"}>
                          ₹{customer.avg_payment_amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{customer.payment_frequency}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerSummary;
