/**
 * Authoritative Razorpay Native Checkout bridge for React Native & Expo.
 * Directly invokes react-native-razorpay native Android/iOS SDK.
 * In production environments, never falls back to mock or simulated payment success.
 */
import { Platform } from "react-native";

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number | string; // In paise (e.g. 50000 for ₹500.00)
  name: string;
  description: string;
  order_id: string; // Razorpay order identifier created by backend
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayErrorResponse {
  code: number;
  description: string;
}

export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResponse> {
  const isProduction = process.env.NODE_ENV === "production" || process.env.EXPO_PUBLIC_APP_ENV === "production";

  // Native Android and iOS checkout execution
  if (Platform.OS === "android" || Platform.OS === "ios") {
    try {
      const RazorpayCheckout = require("react-native-razorpay").default || require("react-native-razorpay");
      if (RazorpayCheckout && typeof RazorpayCheckout.open === "function") {
        return await RazorpayCheckout.open(options);
      }
    } catch (err) {
      if (isProduction) {
        throw new Error("Razorpay native checkout module is not available in this production build.");
      }
      console.warn("Native Razorpay module not loaded in local dev client, checking dev fallback:", err);
    }
  }

  // Strictly reject simulation in production builds
  if (isProduction) {
    throw new Error("Native Razorpay Checkout is required for production payments. Web/Simulated payments are disabled in production.");
  }

  // Development Preview / Test environment fallback
  return new Promise((resolve) => {
    setTimeout(() => {
      const simulatedPaymentId = `pay_test_${Date.now()}`;
      resolve({
        razorpay_payment_id: simulatedPaymentId,
        razorpay_order_id: options.order_id,
        razorpay_signature: `dev_sig_${options.order_id}_${simulatedPaymentId}`
      });
    }, 1200);
  });
}
