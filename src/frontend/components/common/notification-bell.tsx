import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Bell,
  X,
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  useGlobalContext,
  type NotificationAction,
  type Notification,
} from "@/context/global-context";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export function Notifications() {
  const {
    notifications,
    dismissNotification,
    markAllNotificationsAsRead,
    executeNotificationAction,
  } = useGlobalContext();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalNotificationId, setModalNotificationId] = useState<string | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [shownToastIds, setShownToastIds] = useState<Set<string>>(new Set());

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return (b.priority || 0) - (a.priority || 0);
    });
  }, [notifications]);

  const modalNotification = useMemo(() => {
    return notifications.find((n) => n.id === modalNotificationId);
  }, [notifications, modalNotificationId]);

  const isModalUnclosable = useMemo(() => {
    if (!modalNotification) return false;

    const hasDismissAction = modalNotification.actions?.some(
      (a) => a.type === "dismiss" || a.type === "action"
    );

    return modalNotification.dismissible === false && !hasDismissAction;
  }, [modalNotification]);

  useEffect(() => {
    const now = new Date();
    let potentialModalId: string | null = null;
    let highestModalPriority = -Infinity;

    const newlyShownToasts = new Set<string>();

    notifications.forEach((notification) => {
      if (notification.isRead) return;
      const startDate = new Date(notification.startDate);
      const endDate = notification.endDate
        ? new Date(notification.endDate)
        : null;
      if (startDate > now || (endDate && endDate <= now)) {
        return;
      }

      if (notification.displayType === "modal") {
        if ((notification.priority ?? 0) > highestModalPriority) {
          highestModalPriority = notification.priority ?? 0;
          potentialModalId = notification.id;
        }
      }

      if (
        notification.displayType === "toast" &&
        !shownToastIds.has(notification.id)
      ) {
        console.log("Triggering toast for:", notification.title);

        const toastOptions: Parameters<typeof toast>[1] = {
          id: notification.id,
          duration: notification.dismissible ? 5000 : Infinity,
          description: notification.message,
          action: notification.actions?.find((a) => a.type !== "dismiss")
            ? {
                label: notification.actions.find((a) => a.type !== "dismiss")!
                  .label,
                onClick: () =>
                  handleActionClick(
                    notification.id,
                    notification.actions!.find((a) => a.type !== "dismiss")!
                  ),
              }
            : undefined,

          closeButton:
            notification.dismissible &&
            !notification.actions?.some((a) => a.type !== "dismiss"),
          onDismiss: () => {
            console.log(`Toast ${notification.id} dismissed`);
          },
          onAutoClose: () => {
            console.log(`Toast ${notification.id} auto-closed`);
          },
        };

        switch (notification.type) {
          case "error":
            toast.error(notification.title, toastOptions);
            break;
          case "warning":
            toast.warning(notification.title, toastOptions);
            break;
          case "update":
            toast.success(notification.title, toastOptions);
            break;
          case "info":
          default:
            toast.info(notification.title, toastOptions);
            break;
        }

        newlyShownToasts.add(notification.id);
      }
    });

    if (potentialModalId && potentialModalId !== modalNotificationId) {
      console.log("Setting modal notification ID:", potentialModalId);
      setModalNotificationId(potentialModalId);
      setIsModalOpen(true);
    }

    if (newlyShownToasts.size > 0) {
      setShownToastIds((prev) => new Set([...prev, ...newlyShownToasts]));
    }
  }, [notifications, shownToastIds, modalNotificationId]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        console.log("Modal closing, ID:", modalNotificationId);
        const notificationToClose = notifications.find(
          (n) => n.id === modalNotificationId
        );

        const canDismissOnClose =
          notificationToClose?.dismissible !== false ||
          notificationToClose?.actions?.some((a) => a.type === "dismiss");

        if (notificationToClose && canDismissOnClose) {
          console.log(
            "Dismissing notification via modal close:",
            modalNotificationId
          );
          dismissNotification(modalNotificationId!);
        } else if (notificationToClose) {
          console.log(
            "Marking as read on modal close (non-dismissible):",
            modalNotificationId
          );
          if (!notificationToClose.isRead) {
            executeNotificationAction(
              modalNotificationId!,
              "mark_read_internal"
            );
          }
        }

        setIsModalOpen(false);
        setModalNotificationId(null);
      } else {
        setIsModalOpen(true);

        if (modalNotificationId && !modalNotification?.isRead) {
          console.log("Marking as read on modal open:", modalNotificationId);

          executeNotificationAction(modalNotificationId, "mark_read_internal");
        }
      }
    },
    [
      modalNotificationId,
      notifications,
      dismissNotification,
      executeNotificationAction,
      modalNotification?.isRead,
    ]
  );

  const handleActionClick = (
    notificationId: string,
    action: NotificationAction
  ) => {
    console.log(
      `Action clicked: ${action.label} (Type: ${action.type}) for Notification: ${notificationId}`
    );

    setPopoverOpen(false);

    if (isModalOpen && notificationId === modalNotificationId) {
    }

    if (action.actionId) {
      executeNotificationAction(notificationId, action.actionId);
    } else if (action.url) {
      window.electronAPI?.shell?.openExternal?.(action.url);
      console.log("Opening external link:", action.url);

      executeNotificationAction(notificationId, "link_followed_internal");
    } else if (action.type === "dismiss") {
      dismissNotification(notificationId);
    }

    if (notificationId === modalNotificationId) {
      setModalNotificationId(null);
      setIsModalOpen(false);
    }
  };

  const handleDismissClick = (notificationId: string) => {
    dismissNotification(notificationId);
    setPopoverOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "update":
        return <Gift className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      console.error("Invalid date format:", dateString, e);
      return "Invalid date";
    }
  };

  return (
    <TooltipProvider>
      {/* --- Bell Popover --- */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8"
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute text-white dark:text-primary -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full text-[10px] leading-none"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom">
            <p>Notifications</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 sm:w-96 p-0 shadow-xl" align="end">
          {/* Header */}
          <div className="flex items-center justify-between p-3 gap-4 border-b">
            <h4 className="font-semibold text-sm">Notifications</h4>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-xs h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={markAllNotificationsAsRead}
                      aria-label="Mark all notifications as read"
                    >
                      <CheckCircle size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Mark all as read</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Badge variant="secondary">{notifications.length} Total</Badge>
            </div>
          </div>

          {/* Notification List */}
          <ScrollArea className="h-[350px]">
            {sortedNotifications.length > 0 ? (
              <div className="divide-y">
                {sortedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 transition-colors duration-150 ease-in-out",
                      !notification.isRead
                        ? "bg-primary/5"
                        : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="pt-0.5 text-muted-foreground">
                        {getNotificationIcon(notification.type)}
                      </div>
                      {/* Content */}
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <p
                          className="text-sm font-medium leading-snug truncate"
                          title={notification.title}
                        >
                          {notification.title || "Notification"}
                        </p>
                        <p className="text-xs text-muted-foreground leading-normal">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/80 pt-0.5">
                          {formatTimestamp(notification.startDate)}
                        </p>
                        {/* Action Buttons (in list view) */}
                        {notification.actions &&
                          notification.actions.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {notification.actions.map((action, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    handleActionClick(notification.id, action)
                                  }
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}
                      </div>
                      {/* Dismiss Button (in list view) */}
                      {/* Show dismiss 'X' only if explicitly dismissible OR if it has a dismiss action */}
                      {(notification.dismissible ||
                        notification.actions?.some(
                          (a) => a.type === "dismiss"
                        )) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() =>
                                handleDismissClick(notification.id)
                              }
                              aria-label="Dismiss notification"
                            >
                              <X size={14} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Dismiss</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[350px] text-center p-4">
                <Bell size={32} className="text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You have no new notifications.
                </p>
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* --- Modal Dialog --- */}
      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          onInteractOutside={(e) => {
            if (isModalUnclosable) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isModalUnclosable) {
              e.preventDefault();
            }
          }}
          hideCloseButton={isModalUnclosable}
        >
          {modalNotification && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {getNotificationIcon(modalNotification.type)}
                  <DialogTitle>
                    {modalNotification.title || "Notification"}
                  </DialogTitle>
                </div>
                <DialogDescription>
                  {modalNotification.message}
                </DialogDescription>
              </DialogHeader>

              {modalNotification.actions &&
                modalNotification.actions.length > 0 && (
                  <DialogFooter className="mt-4 sm:justify-end flex-wrap gap-2">
                    {modalNotification.actions.map((action, index) => (
                      <Button
                        key={index}
                        variant="default"
                        onClick={() =>
                          handleActionClick(modalNotification!.id, action)
                        }
                        size="sm"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </DialogFooter>
                )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

const DialogContentWithConditionalClose = ({
  children,
  hideCloseButton,
  ...props
}: any) => {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          props.className
        )}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

import { ComponentPropsWithoutRef, ElementRef } from "react";

declare module "@radix-ui/react-dialog" {
  interface DialogContentProps {
    hideCloseButton?: boolean;
  }
}

declare module "@/components/ui/dialog" {
  interface DialogContentProps
    extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    hideCloseButton?: boolean;
  }
}
