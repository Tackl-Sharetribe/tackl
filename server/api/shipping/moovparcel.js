/**
 * MoovParcel API helper utilities.
 *
 * Provides shared configuration, headers, and a generic request helper
 * for all MoovParcel / shipping endpoints.
 */

const moment = require('moment');
const log = require('../../log');

const MOOVPARCEL_BASE_URL = 'https://production.courierapi.co.uk';
const BILLING_API_BASE_URL = 'https://production.billingapi.co.uk';

// API paths
const PATHS = {
  createLabel: '/api/couriers/v1/MoovParcel/create-label',
  getQuote: '/api/customer-routes/get-quote',
};

/**
 * Build MoovParcel courier API headers.
 * Read from env at call-time so the values are always up to date.
 *
 * @returns {Object} headers for the courier API
 */
const getCourierHeaders = () => {
  const { SHIPPING_API_USER, SHIPPING_API_TOKEN } = process.env;

  if (!SHIPPING_API_USER || !SHIPPING_API_TOKEN) {
    throw new Error('Missing SHIPPING_API_USER or SHIPPING_API_TOKEN environment variables');
  }

  return {
    'api-user': SHIPPING_API_USER,
    'api-token': SHIPPING_API_TOKEN,
    'Content-Type': 'application/json',
  };
};

/**
 * Build MoovParcel billing API headers.
 *
 * @returns {Object} headers for the billing/pricing API
 */
const getBillingHeaders = () => {
  const { SHIPPING_API_USER, SHIPPING_CUSTOMER_KEY } = process.env;

  if (!SHIPPING_API_USER || !SHIPPING_CUSTOMER_KEY) {
    throw new Error('Missing SHIPPING_API_USER or SHIPPING_CUSTOMER_KEY environment variables');
  }

  return {
    client_name: 'Moov Parcel',
    customer_dc_id: SHIPPING_API_USER,
    customer_key: SHIPPING_CUSTOMER_KEY,
    'Content-Type': 'application/json',
  };
};

/**
 * Send a request to a MoovParcel API endpoint and return parsed JSON.
 *
 * @param {string} url - Full URL to call
 * @param {Object} options - fetch options (method, headers, body, etc.)
 * @param {string} label - Human-readable label for logging
 * @returns {Promise<Object>} parsed response data
 * @throws {Error} with status, statusText, and data properties on non-2xx responses
 */
const moovRequest = async (url, options, label = 'MoovParcel') => {
  const response = await fetch(url, options);

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (_e) {
    log.error(new Error(`${label}: failed to parse response`), label, { responseText });
    data = { message: responseText };
  }

  if (!response.ok) {
    log.error(new Error(`${label}: request failed (${response.status})`), label, data);
    const error = new Error(`${label} request failed with status ${response.status}`);
    error.status = response.status;
    error.statusText = response.statusText || 'Bad Request';
    error.data = data;
    throw error;
  }

  return data;
};

/**
 * Convert an address stored in the app's `protectedData.address` shape
 * (using `recipient*` field names) into the shape expected by the MoovParcel API.
 *
 * App shape:  { recipientName, recipientPhoneNumber, recipientAddressLine1,
 *               recipientAddressLine2, recipientCity, recipientPostal,
 *               recipientCountry, recipientState }
 * MoovParcel: { name, phone, address_1, address_2, city, postcode, country_iso }
 *
 * @param {Object} address - App-format address from protectedData
 * @returns {Object} MoovParcel-format address
 */
const toMoovAddress = (address = {}) => {
  const {
    recipientName,
    recipientPhoneNumber,
    recipientAddressLine1,
    recipientAddressLine2,
    recipientCity,
    recipientPostal,
    recipientCountry,
    recipientState,
  } = address;

  return {
    name: recipientName || '',
    phone: recipientPhoneNumber || '',
    address_1: recipientAddressLine1 || '',
    address_2: recipientAddressLine2 || '',
    city: recipientCity || '',
    postcode: recipientPostal || '',
    country_iso: recipientCountry || 'GB',
  };
};

/**
 * Build a MoovParcel parcel object from listing publicData.
 *
 * @param {Object} publicData   - Listing's publicData
 * @param {string} listingTitle - Used as item description
 * @param {string} listingPrice - Price in major units e.g. '12.50'
 * @returns {Object}
 */
const buildParcel = (publicData = {}, listingTitle = '', listingPrice = '0.00') => {
  const { length, width, height, weight } = publicData;
  return {
    dim_length: Number(length) || 30,
    dim_width: Number(width) || 20,
    dim_height: Number(height) || 10,
    dim_unit: 'cm',
    items: [
      {
        description: listingTitle,
        origin_country: 'GB',
        quantity: 1,
        value_currency: 'GBP',
        value: listingPrice,
        weight: Number(weight) || 1,
        weight_unit: 'KG',
      },
    ],
  };
};

/**
 * Returns a collection date 3 days from now formatted for MoovParcel.
 *
 * @returns {string} e.g. '2026-03-06 12:00:00'
 */
const getCollectionDate = () =>
  moment()
    .add(3, 'days')
    .format('YYYY-MM-DD HH:mm:ss');

/**
 * Build the base shipment object shared between get-quote and create-label requests.
 *
 * @param {Object} ship_from
 * @param {Object} ship_to
 * @param {Array}  parcels
 * @param {Object} [opts]
 * @param {string} [opts.reference='']      - Shipment reference
 * @param {string} [opts.collection_date]   - Override collection date; defaults to getCollectionDate()
 * @returns {Object}
 */
const buildShipment = (ship_from, ship_to, parcels, { reference = '', collection_date } = {}) => ({
  collection_date: collection_date || getCollectionDate(),
  reference,
  reference_2: '',
  delivery_instructions: '',
  ship_from,
  ship_to,
  parcels,
});

/**
 * Resolve the MoovParcel dc_service_id from a carrier string.
 *
 * @param {string} carrier - 'dpd' | 'yodel'
 * @returns {string}
 */
const getServiceId = carrier => (carrier === 'yodel' ? 'YOD-C2CPS' : 'DPD-12DROPQR');

/**
 * Fetch a shipping rate from the MoovParcel Billing API for a given carrier.
 *
 * @param {Object} shipment - Base shipment object (ship_from, ship_to, parcels, collection_date)
 * @param {string} carrier  - 'dpd' | 'yodel'
 * @returns {Promise<number|null>} Price as returned by the API, or null if no matching service found
 */
const getShippingRate = async (shipment, carrier) => {
  const requestData = {
    auth_company: '',
    format_address_default: true,
    request_id: `rate-${Date.now()}`,
    shipment,
  };

  const url = `${BILLING_API_BASE_URL}${PATHS.getQuote}`;
  const data = await moovRequest(
    url,
    {
      method: 'POST',
      headers: getBillingHeaders(),
      body: JSON.stringify(requestData),
    },
    'MoovParcel getQuote'
  );

  const serviceCode = carrier === 'yodel' ? 'YODC2C' : 'DPD-12DROPQR';
  const match = data.find(elm => elm.service_code === serviceCode);
  return match?.price?.total ?? null;
};

/**
 * Return shipping price in major currency units for a carrier.
 * Returns null if parcel does not satisfy carrier constraints.
 *
 * DPD rates (UK Mainland - Next Day):
 *  - <= 2kg:  4.35
 *  - <= 5kg:  4.95
 *  - <= 20kg: 5.95
 *  Constraints: length/width/height <= 60cm and L+W+H <= 180cm
 *
 * Yodel rates (UK Mainland - Store to Door):
 *  - Xpect Mini <= 1kg:   2.95
 *  - Xpect Mini <= 2kg:   3.30
 *  - Xpect Medium <= 5kg: 4.20
 *  - Xpect Medium <= 10kg: 5.10
 *  Constraints:
 *  - Mini:   length <= 50cm, L+W <= 80cm, volume <= 0.031m3
 *  - Medium: length <= 90cm, L+W <= 150cm, volume <= 0.113m3
 */
const getShippingPriceByCarrier = (carrier, dimensions = {}) => {
  const withMarkup = basePrice => Number((basePrice * 1.2).toFixed(2));
  const normalizedCarrier = (carrier || '').toLowerCase();
  const length = Number(dimensions.length);
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  const weight = Number(dimensions.weight);

  const hasValidNumbers = [length, width, height, weight].every(Number.isFinite);
  if (!hasValidNumbers || length <= 0 || width <= 0 || height <= 0 || weight <= 0) {
    return null;
  }

  const volumeM3 = (length * width * height) / 1000000;

  if (normalizedCarrier === 'dpd') {
    const meetsDpdSize =
      length <= 60 && width <= 60 && height <= 60 && length + width + height <= 180;

    if (!meetsDpdSize || weight > 20) {
      return null;
    }

    if (weight <= 2) {
      return withMarkup(4.35);
    }
    if (weight <= 5) {
      return withMarkup(4.95);
    }
    return withMarkup(5.95);
  }

  if (normalizedCarrier === 'yodel') {
    const miniSizeOk = length <= 50 && length + width <= 80 && volumeM3 <= 0.031;
    const mediumSizeOk = length <= 90 && length + width <= 150 && volumeM3 <= 0.113;

    if (miniSizeOk && weight <= 1) {
      return withMarkup(2.95);
    }
    if (miniSizeOk && weight <= 2) {
      return withMarkup(3.3);
    }
    if (mediumSizeOk && weight <= 5) {
      return withMarkup(4.2);
    }
    if (mediumSizeOk && weight <= 10) {
      return withMarkup(5.1);
    }

    return null;
  }

  return null;
};

module.exports = {
  MOOVPARCEL_BASE_URL,
  BILLING_API_BASE_URL,
  PATHS,
  getCourierHeaders,
  getBillingHeaders,
  moovRequest,
  toMoovAddress,
  buildParcel,
  buildShipment,
  getCollectionDate,
  getServiceId,
  getShippingRate,
  getShippingPriceByCarrier,
};
