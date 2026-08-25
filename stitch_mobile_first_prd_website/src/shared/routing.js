export async function addDrivingTimes(restaurants, coordinates) {
  const routableRestaurants = restaurants.filter(restaurant => Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude));
  if (!coordinates || !routableRestaurants.length) return restaurants;

  const destinations = routableRestaurants.map(restaurant => `${restaurant.longitude},${restaurant.latitude}`).join(';');
  const query = new URLSearchParams({
    originLat: String(coordinates.latitude),
    originLng: String(coordinates.longitude),
    destinations,
  });
  const response = await fetch(`/api/driving-times?${query}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '차량 이동시간을 계산하지 못했습니다.');

  const routesByName = new Map(routableRestaurants.map((restaurant, index) => [
    `${restaurant.name}|${restaurant.address}`,
    data.routes?.[index] || {},
  ]));

  return restaurants.map(restaurant => {
    const route = routesByName.get(`${restaurant.name}|${restaurant.address}`);
    if (!route || !Number.isFinite(route.durationSeconds)) return restaurant;
    return {
      ...restaurant,
      drivingMinutes: Math.max(1, Math.ceil(route.durationSeconds / 60)),
      drivingDistanceMeters: route.distanceMeters,
    };
  });
}

export function filterByDrivingTime(restaurants, maxMinutes) {
  return restaurants.filter(restaurant => !Number.isFinite(restaurant.drivingMinutes) || restaurant.drivingMinutes <= maxMinutes);
}

export function drivingSummary(restaurant) {
  if (!Number.isFinite(restaurant.drivingMinutes)) return '차량 시간 확인 불가';
  const distance = Number.isFinite(restaurant.drivingDistanceMeters)
    ? ` · ${(restaurant.drivingDistanceMeters / 1000).toFixed(1)}km`
    : '';
  return `차량 약 ${restaurant.drivingMinutes}분${distance}`;
}
