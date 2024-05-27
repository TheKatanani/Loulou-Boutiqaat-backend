const { Op } = require("sequelize")
const db = require("../models")
const User = db.users

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({ 
      attributes:{
        exclude:['refreshToken']
      }
    })
    res.status(200).json(users)
  } catch (err) {
    res.status(400).json({
      message: `Users Not Found! `
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
// const createUser = (req, res) => {
//   const user = {
//     "id": v4(),
//     "name": req.body?.name,
//     "phone": req.body?.phone,
//     "password": req.body?.password,
//     "gendar": req.body?.gendar,
//     "barthDay": req.body?.barthDay,
//     "role": req.body?.role
//   } //new user
//   // you must add validation here 
//   // in this example you update the fucken variable not the json object
//   const isExist = users.data.find(_user => _user.id === user?.id)
//   if (isExist) {
//     const filterUsers = users.data.filter(_user => _user.id !== parseInt(user.id))
//     users.setData([...filterUsers, user])
//   } else {
//     users.setData([...users.data, user])
//   }
//   res.json(user)
// } there create user in the register controller
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
      const updated = await User.update({
        ...foundedUser,
        ...user
      }, {
        where: {
          id
        }
      })
      if (updated) {
        res.json({
          success: `User with ID:${id}, updated successfoly!`
        })
      } else {
        res.json({
          message: 'something went wrong!'
        })
      }
    } else {
      res.status(400).json({
        message: `User ID ${req.params.id} Is Not Found! `
      })
    }
    res.status(201).json(user)
  } catch (err) {
    res.json({
      message: `something went wrong!,Error:${err}`
    })
  }
}
const deleteUser =async (req, res) => {
  const id = req.params.id  
  try{

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
      success:`the user with ID:${id} was deleted!`
    })
  } else {
    res.status(400).json({
      message: `User ID ${req.params.id} Is Not Found!`
    })
  } 
}catch (err){
  res.status(400).json({
    message: `Something Went Wrong!`

  })
}
}
module.exports = {
  getAllUsers,
  getUser,
  // createUser,
  updateUser,
  deleteUser
}