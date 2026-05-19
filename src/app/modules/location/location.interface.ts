export type ILocationSuggestion = {
  description: string
  placeId: string
  mainText: string
  secondaryText: string
}

export type IGeocodeResponse = {
  lat: number
  lng: number
  formattedAddress: string
  placeId: string
}
