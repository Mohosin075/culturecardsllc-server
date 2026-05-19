import axios from 'axios'
import config from '../../../config'
import ApiError from '../../../errors/ApiError'
import { StatusCodes } from 'http-status-codes'
import { IGeocodeResponse, ILocationSuggestion } from './location.interface'

const searchSuggestions = async (
  query: string,
): Promise<ILocationSuggestion[]> => {
  const apiKey = config.server_map_api_key
  if (!apiKey) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Map API key is not configured',
    )
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input: query,
          key: apiKey,
        },
      },
    )

    if (
      response.data.status !== 'OK' &&
      response.data.status !== 'ZERO_RESULTS'
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Google API Error: ${response.data.status}`,
      )
    }

    const predictions = response.data.predictions || []

    return predictions.map((prediction: any) => ({
      description: prediction.description,
      placeId: prediction.place_id,
      mainText: prediction.structured_formatting.main_text,
      secondaryText: prediction.structured_formatting.secondary_text,
    }))
  } catch (error: any) {
    throw new ApiError(
      error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to fetch suggestions',
    )
  }
}

const geocodeAddress = async (address: string): Promise<IGeocodeResponse> => {
  const apiKey = config.server_map_api_key
  if (!apiKey) {
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Map API key is not configured',
    )
  }

  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: apiKey,
        },
      },
    )

    if (response.data.status === 'ZERO_RESULTS') {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Location not found')
    }

    if (response.data.status !== 'OK') {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Google API Error: ${response.data.status}`,
      )
    }

    const result = response.data.results[0]
    const { lat, lng } = result.geometry.location

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    }
  } catch (error: any) {
    throw new ApiError(
      error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to geocode address',
    )
  }
}

export const LocationServices = {
  searchSuggestions,
  geocodeAddress,
}
