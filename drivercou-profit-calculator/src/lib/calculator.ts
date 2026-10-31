import type { Calculation, Settings, TripInput } from '../types'

// Round monetary values to cents at each displayed cost boundary.
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function calculateTrip(input: TripInput, settings: Settings): Calculation {
  const totalKm = Math.max(0, input.pickupKm) + Math.max(0, input.passengerKm) + Math.max(0, input.returnKm)
  const fuelCost = money(totalKm * settings.consumptionPer100 * settings.fuelPrice / 100)
  const maintenanceCost = money(totalKm * settings.maintenancePerKm)
  const totalCost = money(fuelCost + maintenanceCost + Math.max(0, input.extraExpenses))
  const rate = input.fareMode === 'gross' ? Math.min(100, Math.max(0, input.commissionRate)) : 0
  const netFare = money(Math.max(0, input.fare) * (1 - rate / 100))
  const netProfit = money(netFare - totalCost)
  const hourlyProfit = input.totalMinutes > 0 ? money(netProfit * 60 / input.totalMinutes) : 0
  const targetByTrip = totalCost + settings.minNetProfit
  const targetByHour = input.totalMinutes > 0 ? totalCost + settings.hourlyTarget * input.totalMinutes / 60 : targetByTrip
  const requiredNetFare = money(Math.max(targetByTrip, targetByHour))
  const requiredFare = input.fareMode === 'gross' && rate < 100
    ? money(requiredNetFare / (1 - rate / 100))
    : requiredNetFare
  const fareGap = money(requiredFare - Math.max(0, input.fare))
  let decision: Calculation['decision']
  let decisionReason: string
  if (input.fareMode === 'unknown') {
    decision = 'review'; decisionReason = 'أكد أولًا هل الأجرة صافية أم إجمالية قبل اعتماد قرار الربحية.'
  } else if (input.totalMinutes <= 0) {
    decision = 'review'; decisionReason = 'أدخل وقتًا صحيحًا للرحلة قبل اتخاذ القرار.'
  } else if (netProfit < settings.minNetProfit) {
    decision = 'reject'; decisionReason = `صافي الربح أقل من الحد الأدنى ${settings.minNetProfit.toFixed(2)} ج.م.`
  } else if (hourlyProfit < settings.hourlyTarget) {
    decision = 'review'; decisionReason = `الربح إيجابي، لكن العائد بالساعة أقل من هدفك ${settings.hourlyTarget.toFixed(2)} ج.م.`
  } else {
    decision = 'accept'; decisionReason = 'الرحلة تحقق الحد الأدنى لصافي الربح وهدف الربح بالساعة.'
  }
  return { totalKm: money(totalKm), fuelCost, maintenanceCost, totalCost, netFare, netProfit, hourlyProfit, requiredFare, fareGap, decision, decisionReason }
}
