const { getIntegrationSdk, handleError } = require('../api-util/sdk');

module.exports = async (req, res) => {
  try {
    const { txId, metadata } = req.body;
    const iSdk = getIntegrationSdk();

    await iSdk.transactions.updateMetadata({
      id: txId,
      metadata,
    });

    res.status(200).send({
      success: true,
      message: 'Transaction metadata updated successfully',
    });
  } catch (error) {
    console.error('error updating tx metadata', error);
    handleError(res, error);
  }
};
