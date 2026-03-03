import Constants from "expo-constants"
import { Platform } from "react-native"

export const PRO_PRODUCT_ID = "pro_upgrade"

export type PurchaseRecord = {
  productId: string
  transactionId?: string
  transactionReceipt?: string
  purchaseToken?: string
}

type PurchaseHandlers = {
  onPurchaseCompleted: (purchase: PurchaseRecord) => Promise<void> | void
  onPurchaseError?: (error: Error) => void
}

type PurchaseProduct = {
  productId: string
}

class PurchaseService {
  private iap: any | null = null
  private isInitialized = false
  private isInitializing = false
  private updateSubscription: { remove: () => void } | null = null
  private errorSubscription: { remove: () => void } | null = null
  private pendingRequest = false
  private processedTransactions = new Set<string>()
  private handlers: PurchaseHandlers | null = null
  private purchaseResolve: (() => void) | null = null
  private purchaseReject: ((error: Error) => void) | null = null

  async initialize(handlers: PurchaseHandlers): Promise<void> {
    this.handlers = handlers

    if (this.isInitialized || this.isInitializing) {
      return
    }

    this.isInitializing = true
    try {
      if (this.isExpoGo()) {
        throw new Error(
          "In-app purchases are not supported in Expo Go. Use an EAS development build, TestFlight, or Play Internal Testing.",
        )
      }

      // Lazy import prevents Expo Go from crashing at app startup
      // due to NitroModules in react-native-iap.
      this.iap = await import("react-native-iap")
      await this.iap.initConnection()

      if (Platform.OS === "android") {
        try {
          await this.iap.flushFailedPurchasesCachedAsPendingAndroid()
        } catch {
          // Ignore cached pending flush failures; purchase stream still works.
        }
      }

      this.updateSubscription = this.iap.purchaseUpdatedListener(
        async (purchase: any) => {
          try {
            const txKey =
              purchase.transactionId || purchase.purchaseToken || "unknown"
            if (this.processedTransactions.has(txKey)) {
              return
            }

            if (!this.hasPurchaseProof(purchase)) {
              throw new Error("Purchase did not include a valid receipt/token")
            }

            await this.completeTransaction(purchase)
            this.processedTransactions.add(txKey)

            await this.handlers?.onPurchaseCompleted(this.toPurchaseRecord(purchase))
            this.purchaseResolve?.()
            this.purchaseResolve = null
            this.purchaseReject = null
          } catch (error) {
            const parsedError =
              error instanceof Error
                ? error
                : new Error("Failed to complete purchase")
            this.handlers?.onPurchaseError?.(parsedError)
            this.purchaseReject?.(parsedError)
            this.purchaseResolve = null
            this.purchaseReject = null
          } finally {
            this.pendingRequest = false
          }
        },
      )

      this.errorSubscription = this.iap.purchaseErrorListener((error: any) => {
        this.pendingRequest = false
        const parsedError = new Error(error?.message ?? "Purchase failed")
        this.handlers?.onPurchaseError?.(parsedError)
        this.purchaseReject?.(parsedError)
        this.purchaseResolve = null
        this.purchaseReject = null
      })

      this.isInitialized = true
    } finally {
      this.isInitializing = false
    }
  }

  async getProProduct(): Promise<PurchaseProduct | null> {
    const products = await this.fetchProducts()
    return products.find((p) => p.productId === PRO_PRODUCT_ID) ?? null
  }

  async buyPro(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("IAP has not been initialized")
    }
    if (this.pendingRequest) {
      throw new Error("A purchase is already in progress")
    }

    const product = await this.getProProduct()
    if (!product) {
      throw new Error("Pro product is not available in the store")
    }

    this.pendingRequest = true

    return new Promise<void>(async (resolve, reject) => {
      this.purchaseResolve = resolve
      this.purchaseReject = reject
      try {
        if (Platform.OS === "ios") {
          await this.iap?.requestPurchase({ sku: PRO_PRODUCT_ID } as any)
        } else {
          await this.iap?.requestPurchase({ skus: [PRO_PRODUCT_ID] } as any)
        }
      } catch (error) {
        this.pendingRequest = false
        const parsedError =
          error instanceof Error
            ? error
            : new Error("Unable to start purchase")
        this.purchaseReject?.(parsedError)
        this.purchaseResolve = null
        this.purchaseReject = null
      }
    })
  }

  async restorePurchases(): Promise<PurchaseRecord[]> {
    if (!this.isInitialized) {
      throw new Error("IAP has not been initialized")
    }

    const available = await this.iap?.getAvailablePurchases()
    const purchases = Array.isArray(available) ? available : []
    const proPurchases = purchases.filter(
      (p: any) => p.productId === PRO_PRODUCT_ID,
    )

    for (const purchase of proPurchases) {
      if (!this.hasPurchaseProof(purchase)) {
        continue
      }

      const txKey =
        purchase.transactionId || purchase.purchaseToken || "restore-unknown"
      if (!this.processedTransactions.has(txKey)) {
        await this.completeTransaction(purchase)
        this.processedTransactions.add(txKey)
      }
    }

    return proPurchases.map((p: any) => this.toPurchaseRecord(p))
  }

  cleanup(): void {
    this.updateSubscription?.remove()
    this.errorSubscription?.remove()
    this.updateSubscription = null
    this.errorSubscription = null
    this.pendingRequest = false
    this.purchaseResolve = null
    this.purchaseReject = null
    this.isInitialized = false
    this.isInitializing = false
    this.iap?.endConnection?.()
    this.iap = null
  }

  private async fetchProducts(): Promise<PurchaseProduct[]> {
    const result = await this.iap?.getProducts({
      skus: [PRO_PRODUCT_ID],
    } as any)
    return Array.isArray(result) ? result : []
  }

  private hasPurchaseProof(purchase: any): boolean {
    return Boolean(purchase.transactionReceipt || purchase.purchaseToken)
  }

  private toPurchaseRecord(purchase: any): PurchaseRecord {
    return {
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      transactionReceipt: purchase.transactionReceipt,
      purchaseToken: purchase.purchaseToken,
    }
  }

  private async completeTransaction(purchase: any): Promise<void> {
    if (Platform.OS === "android" && purchase.purchaseToken) {
      const isAcknowledged = Boolean(purchase.isAcknowledgedAndroid)
      if (!isAcknowledged) {
        await this.iap?.acknowledgePurchaseAndroid({
          token: purchase.purchaseToken,
        })
      }
    }

    await this.iap?.finishTransaction({ purchase, isConsumable: false } as any)
  }

  private isExpoGo(): boolean {
    return (Constants as any)?.appOwnership === "expo"
  }
}

export const purchaseService = new PurchaseService()
