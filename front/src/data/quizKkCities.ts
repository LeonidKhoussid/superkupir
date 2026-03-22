/**
 * Города Краснодарского края для квиза.
 * `value` должен совпадать с `places.radius_group` в БД (импорт из city_used), сравнение на бэкенде без учёта регистра.
 */
export const QUIZ_KK_CITY_ANY = '__any__' as const

export type QuizKkCityOption = { value: string; label: string }

export const QUIZ_KK_CITY_OPTIONS: readonly QuizKkCityOption[] = [
  { value: QUIZ_KK_CITY_ANY, label: 'Весь край / не важно' },
  { value: 'Краснодар', label: 'Краснодар' },
  { value: 'Сочи', label: 'Сочи' },
  { value: 'Анапа', label: 'Анапа' },
  { value: 'Геленджик', label: 'Геленджик' },
  { value: 'Новороссийск', label: 'Новороссийск' },
  { value: 'Туапсе', label: 'Туапсе' },
  { value: 'Ейск', label: 'Ейск' },
  { value: 'Армавир', label: 'Армавир' },
] as const

export function labelForKkCityValue(value: string | null): string {
  if (value == null || value === '' || value === QUIZ_KK_CITY_ANY) {
    return 'Весь край'
  }
  const hit = QUIZ_KK_CITY_OPTIONS.find((o) => o.value === value)
  return hit?.label ?? value
}
