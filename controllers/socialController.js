const db = require("../models")
const Social = db.social

const getSocialItems = async (req, res) => {
  if (!db.isConnected) {
    return res.status(200).json(db.mockData.mockSocial);
  }
  try {
    const SocialItems = await Social.findAll({
      attributes: ["name", "value"]
    })
    res.status(200).json(SocialItems)
  } catch (err) {
    res.status(200).json(db.mockData.mockSocial);
  }
}

const updateSocial = async (req, res) => {
  const {
    name,
    value
  } = req.body
  if (!db.isConnected) {
    const item = (db.mockData.mockSocial || []).find(s => s.name === name);
    if (item) {
      item.value = value;
    } else {
      db.mockData.mockSocial.push({ name, value });
    }
    return res.sendStatus(200);
  }
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