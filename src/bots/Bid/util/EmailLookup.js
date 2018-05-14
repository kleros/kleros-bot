import path from 'path'
import { google } from 'googleapis'
import { GoogleToken } from 'gtoken'

import privatekey from '../../../../google_key.json'
import * as bidConstants from '../../../constants/bid'

class EmailLookup {
  constructor() {
    this.addressMap = {}
    this.jwtClient

    this._credentialsPath = path.join(__dirname, '../../../../', 'google_key.json')
  }

  /**
   * Get the email address cooresponding to the eth address of a kyc registered user
   */
  fetchEmail = async ethAddress => {
    if (!this.addressMap[ethAddress]) {
      await this.importKYC()

      if (!this.addressMap[ethAddress])
        throw new Error(`ETH address not registered in KYC: ${ethAddress}`)
    }

    return this.addressMap[ethAddress]
  }

  /**
   * Import KYC registrants
   */
  importKYC = async () => {
    if (!this.authToken)
      await this._authenticateGoogleToken()

    try {
      const sheets = google.sheets({version: 'v4', auth: this.jwtClient})

      const data = await new Promise((resolve, reject) => {
        sheets.spreadsheets.values.get({
          spreadsheetId: bidConstants.GOOGLE_SHEET_ID,
          range: 'KYC Registration',
        }, (err, result) => {
          if (err)
            reject(err)
          resolve(result.data)
        })
      })

      return Promise.all(data.values.map(row => {
        const ethAddress = row[20]
        const emailAddress = row[4]
        // console.log(`${ethAddress} -> ${emailAddress}`)
        this.addressMap[ethAddress] = emailAddress
      }))
    } catch (err) {
      console.error(err)
      // re-auth token
      this.authToken = await this._authenticateGoogleToken()
    }
  }

  /**
   * Get new google auth token
   */
  _authenticateGoogleToken = async () => {
    // configure a JWT auth client
    let jwtClient = new google.auth.JWT(
           privatekey.client_email,
           null,
           privatekey.private_key,
           ['https://www.googleapis.com/auth/spreadsheets.readonly'])
    // authenticate request
    await jwtClient.authorize()
    this.jwtClient = jwtClient
  }
}

export default EmailLookup
