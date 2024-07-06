const db = require("../models")
const User = db.users
const bcrypt = require('bcrypt')
const Order = db.order
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ['refreshToken']
      },
    })
    console.log(1)
    let newUsers = users.map(user => {
      user.roles = JSON.parse(user.roles)
      return user
    })
    res.status(200).json(newUsers)
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const getUser = async (req, res) => {
  const id = req.params.id
  const user = await User.findOne({
    where: {
      id
    }
  })
  if (user) {
    res.json({
      user
    })
  } else {
    res.status(400).json({
      message: `User ID ${req.params.id} Is Not Found! `
    })
  }
}
const createUser = async (req, res) => {
  const user = {
    name: req.body?.name,
    phone: req.body?.phone,
    password: req.body?.password,
    gender: req.body?.gender,
    barthDay: req.body?.barthDay,
    roles: req.body?.roles //you must send it as {'ADMIN':1234} FOR EXAMPLE
  } //new user 
  try {
    const isExist = await User.findOne({
      where: {
        phone: user.phone
      }
    })
    if (!!isExist) {
      res.status(409) //conflict 
        .json({
          message: `This User With ${user.phone} Phone Has An Account`
        })
    } else {
      const newPassword = await bcrypt.hash(user?.password, 10)
      user.password = newPassword
      const createdUser = await User.create(user)
      res.status(201).json(createdUser)
    }
  } catch (err) {
    res.status(400).json({
      message: err
    })
  }
}
const updateUser = async (req, res) => {
  const id = req.params.id
  const user = req.body //new user
  try {
    const foundedUser = await User.findOne({
      where: {
        id
      }
    })
    if (foundedUser) {
      const updatedUser = {
        name: foundedUser.name,
        phone: foundedUser.phone,
        password: foundedUser.password,
        gender: foundedUser.gender,
        barthDay: foundedUser.barthDay,
        roles: foundedUser.roles,
        ...user
      } //new user  
      await User.update(updatedUser, {
        where: {
          id
        }
      })
      res.json(updatedUser)
    } else {
      res.status(404).json({
        message: `User ID ${req.params.id} Is Not Found! `
      })
    }
  } catch (err) {
    res.json({
      message: err
    })
  }
}
const deleteUser = async (req, res) => {
  const id = req.params.id
  try {

    const foundedUser = await User.findOne({
      where: {
        id
      }
    })
    if (foundedUser) {
      await User.destroy({
        where: {
          id
        }
      })
      res.json({
        success: `the user with ID:${id} was deleted!`
      })
    } else {
      res.status(400).json({
        message: `User ID ${req.params.id} Is Not Found!`
      })
    }
  } catch (err) {
    res.status(400).json({
      message: `Something Went Wrong!`
    })
  }
}
module.exports = {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
}