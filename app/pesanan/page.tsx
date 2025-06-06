"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, Trash2, ArrowRight, Clock, Save } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import CustomerLayout from "@/components/customer-layout"
import { useToast } from "@/hooks/use-toast"
import { 
  useCurrentOrderQuery, 
  useUpdateOrderMutation, 
  useRemoveOrderItemMutation, 
  useCurrentCheckoutQuery,
  useCreateCheckoutMutation,
  type Order, 
  type OrderItem 
} from "./hooks"
import customFetch from "@/lib/fetch";

export default function PesananPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [localOrder, setLocalOrder] = useState<Order | null>(null)
    // Fetch current order data
  const { data: currentOrder, isLoading, error } = useCurrentOrderQuery()
  const updateOrderMutation = useUpdateOrderMutation()
  const removeItemMutation = useRemoveOrderItemMutation()
  // Fetch current checkout data
  const createCheckoutMutation = useCreateCheckoutMutation()

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  useEffect(() => {
    if (currentOrder) {
      setLocalOrder(currentOrder)
      setHasUnsavedChanges(false)
    }
  }, [currentOrder])

  const updateQuantity = (item: OrderItem, newQuantity: number) => {
    if (!localOrder) return

    const updatedItems = localOrder.items.map(orderItem => {
      if (orderItem.id === item.id) {
        return { 
          ...orderItem, 
          quantity: newQuantity,
          subtotal: orderItem.price * newQuantity
        }
      }
      return orderItem
    })

    const updatedOrder = {
      ...localOrder,
      items: updatedItems,
      total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0)
    }

    setLocalOrder(updatedOrder)
    setHasUnsavedChanges(true)
  }

  const saveChanges = () => {
    if (!localOrder) return

    const updateData = {
      items: localOrder.items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }))
    }

    updateOrderMutation.mutate(updateData, {
      onSuccess: () => {
        toast({
          title: "Order Saved",
          description: "Your order has been saved successfully.",
        })
        setHasUnsavedChanges(false)
      },
      onError: (error: any) => {
        toast({
          title: "Save Failed",
          description: error.message || "Failed to save order",
          variant: "destructive",
        })
      }
    })
  }
  const increaseQuantity = (item: OrderItem) => {
    updateQuantity(item, item.quantity + 1)
  }

  const decreaseQuantity = (item: OrderItem) => {
    if (item.quantity > 1) {
      updateQuantity(item, item.quantity - 1)
    } else {
      handleDeleteClick(item.id)
    }
  }

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId)
    setShowDeleteConfirm(true)
  }
  const handleDeleteConfirm = () => {
    if (!itemToDelete) return
    
    removeItemMutation.mutate(itemToDelete, {
      onSuccess: () => {
        toast({
          title: "Item Removed",
          description: "Item has been removed from your order.",
        })
        setShowDeleteConfirm(false)
        setItemToDelete(null)
      },
      onError: (error: any) => {
        toast({
          title: "Remove Failed",
          description: error.message || "Failed to remove item",
          variant: "destructive",
        })
        setShowDeleteConfirm(false)
        setItemToDelete(null)
      }
    })
  }
  
  const handleProceedToCheckout = () => {
    setShowCheckoutConfirm(true)
  }

  const handleCheckoutConfirm = async () => {
    if (!localOrder) return

    try {
      // First update the order with any local changes
      const updateData = {
        items: localOrder.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        }))
      }

      // Now check if checkout already exists
      const sessionId = localStorage.getItem("session_id")
      if (!sessionId) {
        throw new Error("No session found")
      }

      try {
        const existingCheckout = await customFetch("/api/checkout/me", {
          method: "GET",
          headers: {
            "X-Session-Id": sessionId,
          },
        }, "ohio_order")

        if (!existingCheckout || !existingCheckout.id) {
          createCheckoutMutation.mutate(undefined, {
            onSuccess: () => {
              toast({
                title: "Checkout Created",
                description: "Proceeding to checkout...",
              })
              router.push("/checkout")
            },
            onError: (error: any) => {
              toast({
                title: "Checkout Failed",
                description: error.message || "Failed to create checkout",
                variant: "destructive",
              })
            },
            onSettled: () => {
              setShowCheckoutConfirm(false)
            }
          })
        }

        // If we get here, checkout already exists
        toast({
          title: "Proceeding to Checkout",
          description: "Taking you to your existing checkout...",
        })
        router.push("/checkout")
        setShowCheckoutConfirm(false)

      } catch (checkoutError: any) {
        if (checkoutError.status === 400 || checkoutError.status === 404) {
          createCheckoutMutation.mutate(undefined, {
            onSuccess: () => {
              toast({
                title: "Checkout Created",
                description: "Proceeding to checkout...",
              })
              router.push("/checkout")
            },
            onError: (error: any) => {
              toast({
                title: "Checkout Failed",
                description: error.message || "Failed to create checkout",
                variant: "destructive",
              })
            },
            onSettled: () => {
              setShowCheckoutConfirm(false)
            }
          })
        } else {
          // Some other error occurred
          throw checkoutError
        }
      }

    } catch (error: any) {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to proceed to checkout",
        variant: "destructive",
      })
      setShowCheckoutConfirm(false)
    }
  }

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">Loading your order...</div>
        </div>
      </CustomerLayout>
    )
  }

  if (error) {
    return (
      <CustomerLayout>
        <div className="container mx-auto p-6">
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No active order found</p>
            <Button asChild className="bg-green-700 hover:bg-green-800">
              <Link href="/menu">Browse Menu</Link>
            </Button>
          </Card>
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>

      <div className="container mx-auto p-6">
        <div></div>
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-800 dark:text-green-400">My Orders</h1>
              <p className="text-gray-600 dark:text-gray-300">
                Manage your current order - Table {currentOrder?.nomorMeja}
              </p>
            </div>            {hasUnsavedChanges && !currentOrder?.locked && (
              <Button 
                onClick={saveChanges}
                disabled={updateOrderMutation.isPending}
              >
                <Save className="h-4 w-4" />
                <span>{updateOrderMutation.isPending ? "Saving..." : "Save Changes"}</span>
              </Button>
            )}
          </div>
        </div>        
        {localOrder && localOrder.items.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              {localOrder.items.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    <div
                      className="h-40 sm:w-32 bg-cover bg-center"
                      style={{
                        backgroundImage: `url(https://images.immediate.co.uk/production/volatile/sites/30/2020/08/chorizo-mozarella-gnocchi-bake-cropped-9ab73a3.jpg)`,
                      }}
                    />
                    <div className="flex-1 p-4">
                      <div className="flex justify-between">
                        <h3 className="font-bold text-lg">{item.menuItemName}</h3>
                        <p className="font-bold">{formatPrice(item.price)}</p>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {item.menuItemDescription}
                      </p>
                      {item.menuItemCategory && (
                        <Badge variant="outline" className="mt-2">
                          {item.menuItemCategory}
                        </Badge>
                      )}                      <div className="flex justify-between items-center mt-4">
                        {currentOrder?.locked ? (
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Order Locked - Cannot Edit
                            </Badge>
                            <span className="font-medium">Quantity: {item.quantity}</span>
                          </div>
                        ) : (                        <div className="flex items-center gap-3">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => decreaseQuantity(item)}
                            disabled={updateOrderMutation.isPending || removeItemMutation.isPending || currentOrder?.locked}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-medium">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => increaseQuantity(item)}
                            disabled={updateOrderMutation.isPending || removeItemMutation.isPending || currentOrder?.locked}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        )}

                        <div className="flex items-center gap-4">
                          <p className="font-bold">{formatPrice(item.subtotal)}</p>
                          {!currentOrder?.locked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteClick(item.id)}
                              disabled={removeItemMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>                <CardContent>
                  <div className="space-y-4">
                    {localOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.menuItemName} x {item.quantity}
                        </span>
                        <span>{formatPrice(item.subtotal)}</span>
                      </div>
                    ))}

                    <Separator />

                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>{formatPrice(localOrder.total)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-green-700 hover:bg-green-800"
                    disabled={localOrder.items.length === 0 || updateOrderMutation.isPending}
                    onClick={handleProceedToCheckout}
                  >
                    {updateOrderMutation.isPending ? "Processing..." : "Proceed to Checkout"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">Your order is empty</p>
            <Button asChild className="bg-green-700 hover:bg-green-800">
              <Link href="/menu">Browse Menu</Link>
            </Button>
          </Card>
        )}

        {/* Checkout Confirmation Modal */}
        <AlertDialog open={showCheckoutConfirm} onOpenChange={setShowCheckoutConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Checkout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to proceed to checkout? This will finalize your current order.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>              <AlertDialogAction 
                onClick={handleCheckoutConfirm}
                disabled={updateOrderMutation.isPending || createCheckoutMutation.isPending}
              >
                {updateOrderMutation.isPending || createCheckoutMutation.isPending ? "Processing..." : "Proceed"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Item Confirmation Modal */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this item from your order? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteConfirm}
                disabled={removeItemMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {removeItemMutation.isPending ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CustomerLayout>
  )
}
