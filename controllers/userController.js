const ROLES_LIST = require("../config/roles_list")
const db = require("../models")
const User = db.users
const bcrypt = require('bcryptjs')

const parseRoles = (roles) => {
  if (!roles) return { USER: 2001 };
  if (typeof roles === 'object') return roles;
  try {
    return JSON.parse(roles);
  } catch (e) {
    return { USER: 2001 };
  }
};

const sanitizeUser = (user) => {
  if (!user) return user;
  const u = user.dataValues ? { ...user.dataValues } : { ...user };
  delete u.password;
  delete u.refreshToken;
  u.roles = parseRoles(u.roles);
  return u;
};

const getAllUsers = async (req, res) => {
  if (!db.isConnected) {
    const list = (db.mockData.mockUsers || []).map(sanitizeUser);
    return res.status(200).json(list);
  }
  try {
    const users = await User.findAll({
      attributes: {
        exclude: ['refreshToken', 'password']
      },
    }) 
    let newUsers = (users || []).map(sanitizeUser);
    res.status(200).json(newUsers)
  } catch (err) {
    const list = (db.mockData.mockUsers || []).map(sanitizeUser);
    res.status(200).json(list)
  }
}

const getUser = async (req, res) => {
  const id = req.params.id
  if (!db.isConnected) {
    const user = (db.mockData.mockUsers || []).find(u => u.id == id);
    if (user) return res.json({ user: sanitizeUser(user) });
    return res.status(404).json({ message: `User ID ${id} Is Not Found!` });
  }
  try {
    const user = await User.findOne({
      where: {
        id
      }
    })
    if (user) {
      res.json({
        user: sanitizeUser(user)
      })
    } else {
      res.status(404).json({
        message: `User ID ${req.params.id} Is Not Found! `
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const createUser = async (req, res) => {
  const user = {
    name: req.body?.name,
    phone: req.body?.phone,
    password: req.body?.password,
    gender: req.body?.gender || 'female',
    barthDay: req.body?.barthDay || '2000-01-01',
    roles: req.body?.roles || { USER: 2001 }
  }
  if (!db.isConnected) {
    const isExist = (db.mockData.mockUsers || []).find(u => u.phone === user.phone);
    if (isExist) {
      return res.status(409).json({
        message: `المستخدم صاحب الرقم ${user.phone} مسجل بالفعل`
      });
    }
    const maxId = (db.mockData.mockUsers || []).reduce((max, u) => Math.max(max, u.id || 0), 0);
    const newUser = { id: maxId + 1, ...user };
    db.mockData.mockUsers.push(newUser);
    return res.status(201).json(sanitizeUser(newUser));
  }
  try {
    const isExist = await User.findOne({
      where: {
        phone: user.phone
      }
    })
    if (isExist) {
      return res.status(409).json({
        message: `This User With ${user.phone} Phone Has An Account`
      })
    }
    const newPassword = await bcrypt.hash(user?.password, 10)
    user.password = newPassword
    const createdUser = await User.create(user)
    res.status(201).json(sanitizeUser(createdUser))
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const updateUser = async (req, res) => {
  const id = req.params.id
  const user = req.body
  if (!db.isConnected) {
    const index = (db.mockData.mockUsers || []).findIndex(u => u.id == id);
    if (index === -1) {
      return res.status(404).json({ message: `User ID ${id} Is Not Found!` });
    }
    db.mockData.mockUsers[index] = { ...db.mockData.mockUsers[index], ...user };
    return res.json(sanitizeUser(db.mockData.mockUsers[index]));
  }
  try {
    const foundedUser = await User.findOne({
      where: {
        id
      }
    })
    if (foundedUser) {
      if (user?.password) {
        const newPassword = await bcrypt.hash(user?.password, 10)
        user.password = newPassword
      }
      const updatedUser = {
        name: foundedUser.name,
        phone: foundedUser.phone,
        password: foundedUser.password,
        gender: foundedUser.gender,
        barthDay: foundedUser.barthDay,
        roles: parseRoles(foundedUser.roles),
        ...user
      }
      await User.update(updatedUser, {
        where: {
          id
        }
      })
      res.json(sanitizeUser(updatedUser))
    } else {
      res.status(404).json({
        message: `User ID ${id} Is Not Found! `
      })
    }
  } catch (err) {
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const updateUserInfo = async (req, res) => {
  const id = req.id
  const user = req.body.user
  const password = req.body.password
  const role = req.roles
  if (!db.isConnected) {
    const index = (db.mockData.mockUsers || []).findIndex(u => u.id == id);
    if (index === -1) return res.status(404).json({ message: `User ID ${id} Is Not Found!` });
    db.mockData.mockUsers[index] = { ...db.mockData.mockUsers[index], ...user };
    return res.json(sanitizeUser(db.mockData.mockUsers[index]));
  }
  try {
    const foundedUser = await User.findOne({
      where: {
        id
      }
    })
    if (foundedUser) {
      if (role !== ROLES_LIST.ADMIN) {
        delete user?.roles
      }
      const match = await bcrypt.compare(password, foundedUser?.password)
      if (match) {
        if(user.password){
          if (user.password?.length >= 6) {
            const newPassword = await bcrypt.hash(user?.password, 10)
            user.password = newPassword
          } else {
            return res.status(400).json({
              message: "the password must be more than 6 characters"
            })
          }
        }
        const updatedUser = {
          name: foundedUser.name,
          phone: foundedUser.phone,
          password: foundedUser.password,
          gender: foundedUser.gender,
          barthDay: foundedUser.barthDay,
          roles: parseRoles(foundedUser.roles),
          ...user
        }
        await User.update(updatedUser, {
          where: {
            id
          }
        })
        res.json(sanitizeUser(updatedUser))
      } else {
        res.status(400).json({
          message: `Wrong Password!`
        })
      }
    } else { 
      res.status(404).json({
        message: `User ID ${id} Is Not Found! `
      })
    }
  } catch (err) { 
    res.status(400).json({
      message: err?.message || err
    })
  }
}

const deleteUser = async (req, res) => {
  const id = req.params.id
  if (!db.isConnected) {
    const index = (db.mockData.mockUsers || []).findIndex(u => u.id == id);
    if (index === -1) return res.status(404).json({ message: `User ID ${id} Is Not Found!` });
    db.mockData.mockUsers.splice(index, 1);
    return res.json(Number(id));
  }
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
      res.json(Number(id))
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
  updateUserInfo,
  updateUser,
  deleteUser
}