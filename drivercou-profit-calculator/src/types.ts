export type AppName = 'Uber' | 'DiDi' | 'inDrive' | 'أخرى'
export type FareMode = 'net' | 'gross' | 'unknown'
export type Decision = 'accept' | 'review' | 'reject'
export interface Settings {
  fuelPrice: number
  consumptionPer100: number
  maintenancePerKm: number
  minNetProfit: number
  hourlyTarget: number
  commission: Record<'inDrive' | 'DiDi' | 'أخرى', number>
}
export interface TripInput {
  app: AppName
  fare: number
  fareMode: FareMode
  commissionRate: number
  pickupKm: number
  passengerKm: number
  returnKm: number
  totalMinutes: number
  extraExpenses: number
  notes: string
}
export interface Calculation {
  totalKm: number
  fuelCost: number
  maintenanceCost: number
  totalCost: number
  netFare: number
  netProfit: number
  hourlyProfit: number
  requiredFare: number
  fareGap: number
  decision: Decision
  decisionReason: string
}
export interface SavedTrip extends TripInput, Calculation {
  id: string
  createdAt: string
}
export const DEFAULT_SETTINGS: Settings = {
  fuelPrice: 22.25,
  consumptionPer100: 10,
  maintenancePerKm: 2.5,
  minNetProfit: 50,
  hourlyTarget: 75,
  commission: { inDrive: 0, DiDi: 0, 'أخرى': 0 }
}
export const EMPTY_TRIP: TripInput = {
  app: 'Uber', fare: 165, fareMode: 'net', commissionRate: 0,
  pickupKm: 0, passengerKm: 22, returnKm: 0, totalMinutes: 40,
  extraExpenses: 0, notes: ''
}
