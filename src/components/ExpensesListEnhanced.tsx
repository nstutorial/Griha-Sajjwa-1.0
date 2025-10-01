import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  payment_method: 'cash' | 'bank';
  category: {
    name: string;
  } | null;
}

interface CategorySummary {
  category: string;
  total: number;
}

const ExpensesListEnhanced = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user]);

  const fetchExpenses = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        category:expense_categories(name)
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const expenseDate = new Date(expense.date);
    const matchesDateFrom = !dateFrom || expenseDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || expenseDate <= new Date(dateTo);

    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const categorySummary: CategorySummary[] = filteredExpenses.reduce((acc, expense) => {
    const category = expense.category?.name || 'Uncategorized';
    const existing = acc.find((item) => item.category === category);
    if (existing) {
      existing.total += Number(expense.amount);
    } else {
      acc.push({ category, total: Number(expense.amount) });
    }
    return acc;
  }, [] as CategorySummary[]);

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  if (loading) {
    return <div>Loading expenses...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          placeholder="From date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <Input
          type="date"
          placeholder="To date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categorySummary.map((item) => (
              <div key={item.category} className="flex justify-between items-center">
                <span className="text-sm">{item.category}</span>
                <span className="font-semibold">₹{item.total.toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between items-center font-bold">
              <span>Total</span>
              <span className="text-destructive">₹{totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredExpenses.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No expenses found
            </CardContent>
          </Card>
        ) : (
          filteredExpenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{expense.description}</span>
                  <span className="text-destructive">₹{expense.amount.toFixed(2)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{expense.category?.name || 'Uncategorized'}</span>
                  <span>{format(new Date(expense.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Payment: {expense.payment_method}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ExpensesListEnhanced;
