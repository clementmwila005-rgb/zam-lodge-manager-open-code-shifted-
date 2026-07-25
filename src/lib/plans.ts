export type PlanKey = "starter" | "business" | "pro" | "enterprise" | "trial";

export const WHATSAPP_NUMBER = "+260976621936";
export const WHATSAPP_DIGITS = "260976621936";

export type PlanInfo = {
  key: PlanKey;
  label: string;
  rooms: string;
  price: string;
  roomLimit: number; // 0 = unlimited
  priceNumber: number | null; // null = custom
  staffLimit: number; // 0 = unlimited
};

export const PLANS: PlanInfo[] = [
  {
    key: "trial",
    label: "Trial",
    rooms: "Up to 5 rooms",
    price: "Free",
    roomLimit: 5,
    priceNumber: 0,
    staffLimit: 3,
  },
  {
    key: "starter",
    label: "Starter",
    rooms: "1 – 15 rooms",
    price: "K299.99",
    roomLimit: 15,
    priceNumber: 299.99,
    staffLimit: 5,
  },
  {
    key: "business",
    label: "Business",
    rooms: "16 – 25 rooms",
    price: "K499.99",
    roomLimit: 25,
    priceNumber: 499.99,
    staffLimit: 10,
  },
  {
    key: "pro",
    label: "Pro",
    rooms: "26 – 50 rooms",
    price: "K799.99",
    roomLimit: 50,
    priceNumber: 799.99,
    staffLimit: 20,
  },
  {
    key: "enterprise",
    label: "Enterprise",
    rooms: "51+ rooms",
    price: "Custom pricing",
    roomLimit: 0,
    priceNumber: null,
    staffLimit: 0,
  },
];

export function getPlan(key: string | null | undefined): PlanInfo {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_DIGITS}?text=${encodeURIComponent(message)}`;
}
