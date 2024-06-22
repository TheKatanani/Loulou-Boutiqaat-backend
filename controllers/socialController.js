const db = require("../models")
const Social = db.social

const getSocialItems = async (req, res) => {
  try {
    const SocialItems = await Social.findAll({
      attributes: ["name", "value"]
    })
    res.status(200).json(SocialItems)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}

const updateSocial = async (req, res) => {
  const {
    name,
    value
  } = req.body
  try { 
    await Social.update({
      name,
      value
    }, {
      where: {
        name
      }
    }) 
    res.sendStatus(200)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}



module.exports = {
  getSocialItems,
  updateSocial
}