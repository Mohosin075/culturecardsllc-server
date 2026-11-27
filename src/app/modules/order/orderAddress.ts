/**
 * The delivery address for an order the buyer did not fill in themselves
 * (an auction win). Uses the buyer's saved shipping address, then their
 * profile address. With neither, the fields say "N/A" so no label is bought
 * for a made-up address; an invented "123 Collectors St, AP" used to go here.
 */
export const savedDeliveryAddress = (user: any) => {
  const ship = user?.shipFromAddress
  if (ship?.street1 && ship?.city && ship?.state && ship?.zip) {
    return {
      fullName: ship.name || user?.fullName || user?.name || undefined,
      phone: ship.phone || undefined,
      street: [ship.street1, ship.street2].filter(Boolean).join(', '),
      city: ship.city,
      state: ship.state,
      postalCode: ship.zip,
      country: ship.country || 'US',
    }
  }
  const profile = user?.address
  return {
    fullName: user?.fullName || user?.name || undefined,
    street: profile?.presentAddress || 'N/A',
    city: profile?.city || 'N/A',
    state: 'N/A',
    postalCode: profile?.postalCode || '00000',
    country: profile?.country || 'US',
  }
}
