/**
 * POST /api/shipping/create-label
 *
 * Creates a shipping label via the MoovParcel courier API.
 * Fetches seller and buyer address from the transaction's provider/customer
 * protectedData and converts them to the MoovParcel format.
 *
 * Expected body:
 *  - txId      {string} Sharetribe transaction ID
 *  - carrier   {string} 'dpd' | 'yodel'
 *  - reference {string} Optional human-readable shipment reference
 */

const log = require('../../log');
const { handleError, getIntegrationSdk } = require('../../api-util/sdk');
const { denormalisedResponseEntities } = require('../../api-util/data');
const {
  MOOVPARCEL_BASE_URL,
  PATHS,
  getCourierHeaders,
  moovRequest,
  toMoovAddress,
  buildParcel,
  buildShipment,
  getServiceId,
} = require('./moovparcel');

module.exports = async (req, res) => {
  try {
    const { txId } = req.body || {};

    // ------ Input validation ------
    if (!txId) {
      return res.status(400).json({ error: 'Missing required field: txId.' });
    }
    // ------ Fetch transaction (with provider, listing, customer) ------
    const iSdk = getIntegrationSdk();
    const txRes = await iSdk.transactions.show({
      id: txId,
      include: ['provider', 'listing', 'customer'],
    });

    const tx = denormalisedResponseEntities(txRes)[0];
    const { provider, listing, customer } = tx;

    if (provider.id.uuid !== req.tokenUserId && customer.id.uuid !== req.tokenUserId) {
      return res
        .status(403)
        .json({ error: 'User not authorized to create shipping label for this transaction.' });
    }

    const carrier = tx.attributes.protectedData.carrier;
    // ------ Extract & convert addresses ------
    const sellerAddress = provider?.attributes?.profile?.protectedData?.address;
    const buyerAddress = customer?.attributes?.profile?.protectedData?.address;

    if (!sellerAddress) {
      return res.status(400).json({ error: 'Seller has not saved a shipping address.' });
    }
    if (!buyerAddress) {
      return res.status(400).json({ error: 'Buyer has not saved a shipping address.' });
    }

    const ship_from = toMoovAddress(sellerAddress);
    const ship_to = toMoovAddress(buyerAddress);

    // ------ Build parcel from listing publicData ------
    const listingPublicData = listing?.attributes?.publicData || {};
    const listingTitle = listing?.attributes?.title || '';
    const listingPriceAmount = listing.attributes.price.amount / 100;

    const parcels = [buildParcel(listingPublicData, listingTitle, listingPriceAmount)];

    // ------ Build request payload ------
    const requestData = {
      auth_company: 'Tackl',
      format_address_default: true,
      request_id: txId,
      shipment: {
        label_size: '6x4',
        label_format: 'pdf',
        generate_invoice: false,
        generate_packing_slip: false,
        courier: { auth_company: 'C2C' },
        dc_service_id: getServiceId(carrier),
        ...buildShipment(ship_from, ship_to, parcels, { reference: listingTitle }),
      },
    };

    // ------ Call MoovParcel ------
    const url = `${MOOVPARCEL_BASE_URL}${PATHS.createLabel}`;
    const data = await moovRequest(
      url,
      {
        method: 'POST',
        headers: getCourierHeaders(),
        body: JSON.stringify(requestData),
      },
      'MoovParcel createLabel'
    );

    const courierDetails = {
      tracking_request_id: data.tracking_request_id,
      tracking_request_hash: data.tracking_request_hash,
      key: data.key,
      uri: data.uri,
      courier: data.courier,
      unique_ref: data.courier_specifics?.unique_ref,
      tracking_codes: data.tracking_codes,
    };

    await iSdk.transactions.updateMetadata({
      id: txId,
      metadata: {
        courierDetails,
      },
    });

    return res.status(200).json(courierDetails);
  } catch (error) {
    log.error(error, 'create-label-endpoint', error.data);
    handleError(res, error);
  }
};
