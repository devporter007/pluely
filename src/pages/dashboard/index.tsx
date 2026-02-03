import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GetLicense } from "@/components";
import { PageLayout } from "@/layouts";
import { useApp } from "@/contexts";

const Dashboard = () => {
  const { hasActiveLicense } = useApp();
  const [activity, setActivity] = useState<any>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!hasActiveLicense) {
      setActivity({ data: [], total_tokens_used: 0 });
      return;
    }
    setLoadingActivity(true);
    try {
      const response = await invoke("get_activity");
      const responseData: any = response;
      if (responseData && responseData.success) {
        setActivity(responseData);
      } else {
        setActivity({ data: [], total_tokens_used: 0 });
      }
    } catch (error) {
      setActivity({ data: [], total_tokens_used: 0 });
    } finally {
      setLoadingActivity(false);
    }
  }, [hasActiveLicense]);

  useEffect(() => {
    if (hasActiveLicense) {
      fetchActivity();
    } else {
      setActivity(null);
    }
  }, [fetchActivity, hasActiveLicense]);

  const activityData =
    activity && Array.isArray(activity.data) ? activity.data : [];
  const totalTokens =
    activity && typeof activity.total_tokens_used === "number"
      ? activity.total_tokens_used
      : 0;

  return (
    <PageLayout
      title="Dashboard"
      description=""
      rightSlot={!hasActiveLicense ? <GetLicense /> : null}
    >
      <div className="space-y-4">
        <h2 className="text-sm text-muted-foreground">Overview</h2>
        {loadingActivity ? (
          <div className="p-4 rounded-lg border bg-card">Loading activity...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Total tokens used this month</p>
              <div className="text-lg font-semibold">{totalTokens}</div>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Recent activity</p>
              <div className="text-lg font-semibold">{activityData.length}</div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );

};

export default Dashboard;
