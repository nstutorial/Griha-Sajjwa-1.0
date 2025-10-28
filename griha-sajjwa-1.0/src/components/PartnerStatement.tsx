import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  notes: string | null;
  mahajan_name: string;
}

interface PartnerStatementProps {
  transactions: Transaction[];
}

export function PartnerStatement({ transactions }: PartnerStatementProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Mahajan</TableHead>
            <TableHead>Payment Mode</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No transactions found
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{format(new Date(transaction.payment_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{transaction.mahajan_name}</TableCell>
                <TableCell className="capitalize">{transaction.payment_mode}</TableCell>
                <TableCell className="text-right font-medium">
                  ₹{transaction.amount.toFixed(2)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {transaction.notes || '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
