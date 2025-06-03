'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  Calculator,
  Clock,
  Filter,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { dashboardService, RecentActivity } from '@/lib/api/dashboardService';
import Link from 'next/link';

export default function ActivityPage() {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'quotation' | 'order' | 'client' | 'invoice'>('all');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const result = await dashboardService.getRecentActivity(50); // Get more activities for this page
        if (result.success) {
          setActivities(result.data);
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quotation': return FileText;
      case 'order': return ShoppingCart;
      case 'client': return Users;
      case 'invoice': return Calculator;
      default: return Clock;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'quotation': return 'text-green-600 bg-green-50';
      case 'order': return 'text-orange-600 bg-orange-50';
      case 'client': return 'text-blue-600 bg-blue-50';
      case 'invoice': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(activity => activity.type === filter);

  const filterOptions = [
    { value: 'all', label: 'All Activity', count: activities.length },
    { value: 'quotation', label: 'Quotations', count: activities.filter(a => a.type === 'quotation').length },
    { value: 'order', label: 'Orders', count: activities.filter(a => a.type === 'order').length },
    { value: 'client', label: 'Clients', count: activities.filter(a => a.type === 'client').length },
    { value: 'invoice', label: 'Invoices', count: activities.filter(a => a.type === 'invoice').length },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Timeline</h1>
            <p className="text-gray-600 mt-1">
              Complete overview of your business activities
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Last 30 days</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center space-x-4 overflow-x-auto">
          <Filter className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="flex space-x-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(option.value as 'all' | 'quotation' | 'order' | 'client' | 'invoice')}
                className="flex-shrink-0"
              >
                {option.label}
                {option.count > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {option.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
        
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activity found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No recent activity to display.' 
                : `No recent ${filter} activity to display.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              const iconColor = getActivityColor(activity.type);
              
              return (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {/* Timeline line */}
                  <div className="relative">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < filteredActivities.length - 1 && (
                      <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-gray-200"></div>
                    )}
                  </div>
                  
                  {/* Activity content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {activity.subtitle}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        {activity.status && (
                          <Badge className={getStatusColor(activity.status)}>
                            {activity.status.replace('_', ' ')}
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {activity.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Load More */}
      {filteredActivities.length > 0 && (
        <div className="text-center">
          <Button variant="outline">
            Load More Activity
          </Button>
        </div>
      )}
    </div>
  );
} 