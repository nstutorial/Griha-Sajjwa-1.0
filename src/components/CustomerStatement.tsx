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
import jsPDF from 'jspdf';
import { PDFDownloader } from '@/lib/pdf-download';

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
           description: `Loan - ${loan.description}`,
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

  const exportToPDF = async () => {
    try {
      // Create new PDF document - DIRECT DOWNLOAD, NO PRINT DIALOG
      const doc = new jsPDF();
      
      // Header section - exact format from image
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Statement', 105, 20, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(customer.name, 105, 30, { align: 'center' });
      
      // Add thick underline exactly like image
      doc.setLineWidth(2);
      doc.line(30, 35, 180, 35);
      
      let yPosition = 45;
      
      // Customer Information section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Customer: ${customer.name}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Phone: ${customer.phone || 'N/A'}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Address: ${customer.address || 'N/A'}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Statement Period: ${startDate ? format(new Date(startDate), 'dd/MM/yyyy') : 'All'} - ${endDate ? format(new Date(endDate), 'dd/MM/yyyy') : 'Current'}`, 20, yPosition);
      yPosition += 15;
      
      // Statement Table with proper sizing - fits page width
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      const pageWidth = 210; // A4 page width in mm
      const margin = 20;
      const tableWidth = pageWidth - (margin * 2); // 170mm total width
      const tableStart = margin;
      
      // Adjusted column widths to fit better - increased date column
      const colWidths = [30, 40, 18, 25, 25, 32]; // Total: 170mm
      let colX = tableStart;
      
      // Draw header row with better positioning
      doc.text('Date', colX + colWidths[0]/2, yPosition, { align: 'center' });
      colX += colWidths[0];
      doc.text('Description', colX + 8, yPosition);
      colX += colWidths[1];
      doc.text('Ref', colX + colWidths[2]/2, yPosition, { align: 'center' });
      colX += colWidths[2];
      doc.text('Debit', colX + colWidths[3]/2, yPosition, { align: 'center' });
      colX += colWidths[3];
      doc.text('Credit', colX + colWidths[4]/2, yPosition, { align: 'center' });
      colX += colWidths[4];
      doc.text('Balance', colX + colWidths[5]/2, yPosition, { align: 'center' });
      
      // Draw table border for header
      doc.setLineWidth(0.5);
      doc.rect(tableStart, yPosition - 5, tableWidth, 8);
      
      // Add column separators
      colX = tableStart;
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX += colWidths[i];
        doc.line(colX, yPosition - 5, colX, yPosition + 3);
      }
      
      yPosition += 8;
      
      // Statement entries
      doc.setFont('helvetica', 'normal');
      let runningY = yPosition;
      
      statement.forEach((entry, index) => {
        // Calculate estimated row height before processing
        const estimatedDescLines = entry.description.length > 25 ? Math.ceil(entry.description.length / 25) : 1;
        const estimatedRowHeight = Math.max(8, estimatedDescLines * 4.5 + 6);
        
        // Check if we need a new page before adding this row
        if (runningY + estimatedRowHeight > 270) { // Add new page if needed
          doc.addPage();
          runningY = 20;
          
          // Redraw headers on new page
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          colX = tableStart;
          doc.text('Date', colX + colWidths[0]/2, runningY, { align: 'center' });
          colX += colWidths[0];
          doc.text('Description', colX + 8, runningY);
          colX += colWidths[1];
          doc.text('Ref', colX + colWidths[2]/2, runningY, { align: 'center' });
          colX += colWidths[2];
          doc.text('Debit', colX + colWidths[3]/2, runningY, { align: 'center' });
          colX += colWidths[3];
          doc.text('Credit', colX + colWidths[4]/2, runningY, { align: 'center' });
          colX += colWidths[4];
          doc.text('Balance', colX + colWidths[5]/2, runningY, { align: 'center' });
          
          doc.rect(tableStart, runningY - 5, tableWidth, 8);
          colX = tableStart;
          for (let i = 0; i < colWidths.length - 1; i++) {
            colX += colWidths[i];
            doc.line(colX, runningY - 5, colX, runningY + 3);
          }
          runningY += 8;
          doc.setFont('helvetica', 'normal');
        }
        
        const date = format(new Date(entry.date), 'dd/MM/yyyy');
        
        // Improved text wrapping for description column
        const maxDescLength = 25; // Reduced for better fit
        let description = entry.description;
        const lines: any[] = [];
        
        // Split description into multiple lines if too long
        if (description.length > maxDescLength) {
          const words = description.split(' ');
          let currentLine = '';
          for (const word of words) {
            if (currentLine.length + word.length + 1 > maxDescLength) {
              if (currentLine.trim()) {
                lines.push(currentLine.trim());
              }
              currentLine = word + ' ';
              if (word.length > maxDescLength) {
                // Handle very long words
                lines.push(word.substring(0, maxDescLength - 3) + '...');
                currentLine = '';
              }
            } else {
              currentLine += word + ' ';
            }
          }
          if (currentLine.trim()) {
            lines.push(currentLine.trim());
          }
        } else {
          lines.push(description);
        }
        
        // Ensure at least one line
        if (lines.length === 0) {
          lines.push(description.substring(0, maxDescLength - 3) + '...');
        }
        
        const reference = entry.reference.length > 8 ? entry.reference.substring(0, 6) + '...' : entry.reference;
        const debitText = entry.debit > 0 ? formatCurrency(entry.debit).replace('₹', '') : '-';
        const creditText = entry.credit > 0 ? formatCurrency(entry.credit).replace('₹', '') : '-';
        const balanceText = formatCurrency(entry.balance).replace('₹', '');
        
        // Calculate row height based on number of description lines
        const lineSpacing = 4.5; // Better line spacing
        const minRowHeight = 8; // Minimum row height
        const rowHeight = Math.max(minRowHeight, lines.length * lineSpacing + 6); // Add more padding for bottom clearance
        
        // Place text in columns with proper positioning
        colX = tableStart;
        const borderTop = runningY - 2; // For border drawing
        
        // Date column - centered
        doc.text(date, colX + colWidths[0]/2, runningY + 2, { align: 'center' });
        colX += colWidths[0];
        
        // Multi-line description with proper vertical spacing
        lines.forEach((line, lineIndex) => {
          doc.text(line, colX + 2, borderTop + 3 + (lineIndex * lineSpacing));
        });
        
        colX += colWidths[1];
        doc.text(reference, colX + colWidths[2]/2, runningY + 2, { align: 'center' });
        colX += colWidths[2];
        
        // Debit column (red)
        doc.setTextColor(255, 0, 0);
        doc.text(debitText, colX + colWidths[3]/2, runningY + 2, { align: 'center' });
        colX += colWidths[3];
        
        // Credit column (green)
        doc.setTextColor(0, 128, 0);
        doc.text(creditText, colX + colWidths[4]/2, runningY + 2, { align: 'center' });
        colX += colWidths[4];
        
        // Balance column (black, bold)
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(balanceText, colX + colWidths[5]/2, runningY + 2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        
        // Draw row border with proper positioning
        doc.setTextColor(0, 0, 0); // Reset color
        
        // Draw cell borders for each column
        colX = tableStart;
        for (let i = 0; i < colWidths.length; i++) {
          // Draw cell
          doc.rect(colX, borderTop, colWidths[i], rowHeight);
          colX += colWidths[i];
        }
        
        // Draw horizontal separators for multi-line cells (optional - comment out for cleaner look)
        // if (lines.length > 1) {
        //   colX = tableStart + colWidths[0]; // Description column
        //   for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        //     const sepY = borderTop + (lineIndex * lineSpacing);
        //     doc.line(colX + 2, sepY, colX + colWidths[1] - 2, sepY);
        //   }
        // }

        runningY += rowHeight;
      });
      
      // Summary section
      runningY += 10;
      if (runningY > 240) {
        doc.addPage();
        runningY = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Account Summary', 20, runningY);
      runningY += 15;
      
      // Draw summary background with gray like image
      doc.setFillColor(249, 249, 249);
      doc.rect(20, runningY - 5, 170, 20, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Outstanding Balance: ${formatCurrency(calculateTotalOutstanding()).replace('₹', '')}`, 25, runningY);
      runningY += 6;
      doc.text(`Total Transactions: ${statement.length}`, 25, runningY);
      
      // MOBILE-FRIENDLY DOWNLOAD
      const pdfName = `customer-statement-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const pdfBlob = doc.output('blob');
      
      await PDFDownloader.downloadPDF(pdfBlob, pdfName);
      
      toast({
        title: 'PDF Downloaded',
        description: 'Customer statement has been downloaded as PDF.',
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF statement",
      });
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
