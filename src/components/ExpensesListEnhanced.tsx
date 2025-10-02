import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import AddExpenseDialog from './AddExpenseDialog';
import AddEarningDialog from './AddEarningDialog';
import EditExpenseDialog from './EditExpenseDialog';
import EarningsList from './EarningsList';
import BalanceSheet from './BalanceSheet';
import { useControl } from '@/contexts/ControlContext';
import { useToast } from '@/hooks/use-toast';

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
  const { settings: controlSettings } = useControl();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user, refreshKey]);

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
      .eq('type', 'expense')
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

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleEditExpense = (expense: Expense) => {
    if (!controlSettings.allowEdit) return;
    setSelectedExpense(expense);
    setEditDialogOpen(true);
  };

  const handleQuickDelete = async (expense: Expense) => {
    if (!controlSettings.allowDelete || !user) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${expense.description}"? This action cannot be undone.`);
    if(!confirmed) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Expense deleted",
        description: "The expense has been successfully deleted.",
      });

      handleRefresh();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete expense. Please try again.",
      });
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Tabs defaultValue="expenses" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <AddExpenseDialog onExpenseAdded={handleRefresh} />
          <AddEarningDialog onEarningAdded={handleRefresh} />
        </div>
      </div>

      <TabsContent value="expenses" className="space-y-4">
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
                  <div className="flex items-center gap-2">
                    <span className="text-destructive">₹{expense.amount.toFixed(2)}</span>
                    {(controlSettings.allowEdit || controlSettings.allowDelete) && (
                      <div className="flex gap-1">
                        {controlSettings.allowEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditExpense(expense)}
                            title="Edit expense"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                       {controlSettings.allowDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuickDelete(expense)}
                            title="Delete expense"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <Badge variant="outline">{expense.category?.name || 'Uncategorized'}</Badge>
                  <span>{format(new Date(expense.date), 'dd MMM yyyy')}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Payment: <Badge variant="secondary">{expense.payment_method}</Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </TabsContent>

      <TabsContent value="earnings">
        <EarningsList onRefresh={handleRefresh} />
      </TabsContent>

      <TabsContent value="balance-sheet">
        <BalanceSheet />
      </TabsContent>
      </Tabs>

      {/* Edit Expense Dialog */}
      <EditExpenseDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        expense={selectedExpense}
        onExpenseUpdated={handleRefresh}
      />
    </>
  );
};

export default ExpensesListEnhanced;
