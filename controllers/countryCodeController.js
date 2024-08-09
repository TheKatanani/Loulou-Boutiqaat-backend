const db = require('../models')
const CountryCode = db.countryCode
const getCountryCode = async (req, res) => {
  try {
    let categories = await CountryCode.findAll()
    res.status(200).send(categories)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const addCountryCode = async (req, res) => {
  const id = req.id
  let info = {
    label: req.body?.label,
    value: req.body?.value,
  }
  try {
    const countryCode = await CountryCode.create(info, {
      where: {
        userId: id
      }
    })
    res.status(201).json({
      success: `${countryCode.label} Phone Added successfully!`
    })
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const updateCountryCode = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await CountryCode.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await CountryCode.update(req.body, {
        where: {
          id
        }
      })
      res.json({
        success: `Country Code Updated successfully!`
      })
    } else {
      res.status(404).json({
        message: `can not found this Country Code!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const deleteCountryCode = async (req, res) => {
  const id = req.params.id
  try {
    const foundedItem = await CountryCode.findOne({
      where: {
        id
      }
    })
    if (foundedItem) {
      await CountryCode.destroy({
        where: {
          id
        }
      })
      res.status(200).json({
        message: 'Country Code is deleted!'
      })
    } else {
      res.status(404).json({
        message: 'Country Code is not found!'
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}


module.exports = {
  getCountryCode,
  addCountryCode,
  deleteCountryCode,
  updateCountryCode
}