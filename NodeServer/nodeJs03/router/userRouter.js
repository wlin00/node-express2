const express = require('express');
const router = express.Router();
const Mail = require('../utils/mail');//引入邮箱模块
const codes = {};//将验证码保存在内存中
let user = {};
const User = require('../db/model/UserModel');//导入schema对象，用于前端正确请求后，提供一个nodeJs操作数据库的对象
const request = require('request')
const cookieParser = require('cookie-parser')
const session = require('express-session')


/**
 * @api {post} /user/reg 用户注册
 * @apiName 用户注册
 * @apiGroup User
 *
 * @apiParam {String} id 用户名(required).
 * @apiParam {String} ps 用户密码(required).
 * @apiParam {String} code 邮箱验证码(required).
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */

router.post('/reg', (req, res) => {
    //注册接口，获取数据-->数据处理-->返回数据

    let { us, ps, code } = req.body;
    if (!us || !ps || !code) {
        return res.send({ err: -1, msg: 'params error' });
    }
    if (codes[us] != code) {
        return res.send({ err: -4, msg: '验证码错误' }); //注册接口添加验证码验证，必须当内存中邮箱-验证码键值对匹配时才能注册
    }
    User.find({ us })
        .then((data) => {
            if (data.length === 0) {
                //首先进行数据库查找，如果数据库不存在同名用户，才允许注册,从而在这里return一个new promise，来走then中的代码
                return User.insertMany({ us: us, ps: ps })
            } else {
                // res.send({err:-3,msg:'用户名已存在'})
                throw new Error('用户名已存在')
                return
            }
        })
        .then(() => { res.send({ err: 0, msg: '注册成功' }) })
        .catch((err) => { res.send({ err: -3, msg: err }) })
});

/**
 * @api {post} /user/login 用户登陆
 * @apiName login
 * @apiGroup User
 *
 * @apiParam {String} id 用户名(required).
 * @apiParam {String} ps 用户密码(required).
 *
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/logOut', (req, res) => {
    req.session.destroy();
    user = {}
    res.send({ err: 0, msg: 'quit' })
})

router.post('/login', (req, res) => {
    //登陆接口，获取数据-->数据处理（数据库中存在）-->返回数据
    let { us, ps } = req.body;
    if (!us || !ps) {
        return res.send({ err: -1, msg: '参数错误' });
    }
    User.find({ us: us, ps: ps })
        .then((data) => {
            if (data.length > 0) {
                if (user[us] === undefined) {

                    user[us] = true
                    req.session.login = true;
                    req.session.name = us;
                    //登陆成功，用户信息记录在session里     
                    return res.send({ err: 0, msg: req.session, data: data });
                } else {
                    return res.send({ err: -5, msg: '该用户已登陆' });
                }
            }
            else {
                return res.send({ err: -3, msg: '用户名或密码不正确' });
            }
        })
        .catch(() => { res.send({ err: -2, msg: '内部错误' }) });
});

/**
 * @api {post} /user/getMailCode 用户邮箱验证
 * @apiName 用户邮箱验证
 * @apiGroup User
 *
 * @apiParam {String} mail 用户邮箱(required).
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/getMailCode', (req, res) => {
    let { mail } = req.body;
    let code = parseInt(1000 + Math.floor(Math.random() * 8999));

    //封装发送邮箱验证接口,在mailJs中暴露出一个返回Promise对象的方法
    Mail.send(mail, code).then(() => {
        codes[mail] = code;//验证码保存到全局对象中
        res.send({ err: 0, msg: '验证码发送成功', code: code })
    })
        .catch((err) => { res.send({ err: -1, msg: err + ' send err' }) })

});


/**
 * @api {post} /user/getMailCode 获取邮箱验证码
 * @apiName 获取邮箱验证码
 * @apiGroup User
 *
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/getPhoneCode', (req, res) => {

    //node request模块安装命令：npm install request
    var querystring = require('querystring');


    var queryData = querystring.stringify({
        "mobile": req.body.mobile,  // 接受短信的用户手机号码
        "tpl_id": req.body.tpl_id,  // 您申请的短信模板ID，根据实际情况修改
        "tpl_value": "#code#=1235231",  // 您设置的模板变量，根据实际情况修改
        "key": req.body.key,  // 应用APPKEY(应用详细页查询)
    });

    var queryUrl = 'http://v.juhe.cn/sms/send?' + queryData;

    request(queryUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body) // 打印接口返回内容

            var jsonObj = JSON.parse(body); // 解析接口返回的JSON内容
            console.log(jsonObj)
        } else {
            console.log('请求异常');
        }
    })
});

/**
 * @api {post} /user/getUserByRight 用户id查询
 * @apiName 用户id查询
 * @apiGroup User
 *
 * @apiParam {String} Id 用户id(required).
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/getUserById', (req, res) => {
    //node内置模块： 1、$gte:判断数值是否大于某值； 2、$or：并集操作如:$or:[{...}, {...}]； 3、$regex 判断正则匹配: schema.find({name:{$regex:reg}})
    let { Id } = req.body;
    if (!Id) {
        return res.send({ err: -1, msg: '参数错误' })
    }
    // let reg = new RegExp(Id);//对输入关键字做正则匹配，对name、desc字段做关键字查询

    User.find(
        { _id: Id }
    )
        .then((data) => {
            res.send({ err: 0, list: data })
        })
        .catch((err) => {
            res.send({ err: -2, msg: 'id查询失败' + err })
        })
})

/**
 * @api {post} /user/getUserByRight 按权限分类查询
 * @apiName 用户权限分类查询
 * @apiGroup User
 *
 * @apiParam {Number} right 用户权限标识(required).
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */

router.post('/getUserByRight', (req, res) => {

    let { right } = req.body;
    if (!/^[01]{1}$/.test(right)) {
        return res.send({ err: -1, msg: '参数错误' }); //输入检测
    }
    User.find({ right })
        .then((data) => {
            res.send({ err: 0, list: data ,total:data.length})
        })
        .catch(() => {
            res.send({ err: -2, msg: '权限分类查询失败' })
        })
})



/**
 * @api {post} /user/updateUser 编辑用户
 * @apiName update
 * @apiGroup User
 *
 * @apiParam {String} _id 用户id(required).
 * 
 * @apiParam {String} us    账号.
 * @apiParam {String} ps    密码.
 * @apiParam {String} name  姓名(required).
 * @apiParam {Number} sex   性别(required).
 * @apiParam {String} mail  邮箱(required).
 * @apiParam {Number} phone 联系方式(required).
 * @apiParam {String} img   头像.
 * @apiParam {Number} right 权限.
 * 
 * 
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/updateUser', (req, res) => {

    let { name, _id, sex, mail, phone } = req.body;
    if (!name || !_id || !sex || !mail || !phone) {
        return res.send({ err: -1, msg: '参数错误' }); //输入检测
    }
    User.updateOne({ _id }, { name, sex, mail, phone })
        .then(() => {
            res.send({ err: 0, msg: '更改成功' })
        })
        .catch(() => {
            res.send({ err: -2, msg: '更改失败' })
        })
})



/**
 * @api {post} /user/updateUser 用户权限提升
 * @apiName updateRight
 * @apiGroup User
 *
 * @apiParam {String} _id 用户id(required).
 * 
 * 
 * 
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/updateRight', (req, res) => {

    let { _id } = req.body;
    if (!_id) {
        return res.send({ err: -1, msg: '参数错误' }); //输入检测
    }

    User.find({ _id })
        .then((data) => {
            if (data.length > 0) {
                if (data[0].right === 0) {
                    return User.updateOne({ _id }, { right: 1 })
                } else {
                    return Promise.reject('该用户已经是管理员')
                }
            }
            else {
                return res.send({ err: -3, msg: '该用户不存在' });
            }
        })
        .then(() => {
            return res.send({ err: 0, msg: '权限更改成功' })
        })
        .catch((err) => { res.send({ err: -2, msg: err }) });
})


/**
 * @api {post} /user/updateImg 编辑头像
 * @apiName update
 * @apiGroup User
 *
 * @apiParam {String} _id 用户id(required).
 * 
 * @apiParam {String} img   头像的相对路径.
 * 
 * 
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/updateImg', (req, res) => {

    let { img, _id } = req.body;
    if (!img || !_id) {
        return res.send({ err: -1, msg: '参数错误' }); //输入检测
    }
    User.updateOne({ _id }, { img })
        .then(() => {
            res.send({ err: 0, msg: '更改成功' })
        })
        .catch(() => {
            res.send({ err: -2, msg: '更改失败' })
        })
})


/**
 * @api {post} /user/updatePwd
 * @apiName update
 * @apiGroup User
 *
 * @apiParam {String} _id 用户id(required).
 * @apiParam {String} ps   原密码.
 * @apiParam {String} newPs1   新密码.
 * @apiParam {String} newPs2   确认密码.
 * 
 * 
 * 
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
router.post('/updatePwd', (req, res) => {

    let { ps, newPs1, newPs2, _id } = req.body;
    if (!ps || !newPs1 || !newPs2 || !_id) {
        return res.send({ err: -1, msg: '参数错误' }); //输入检测
    }

    User.find({ _id })
        .then((data) => {
            if (data.length > 0) {
                console.log('data=', data)
                if (data[0].ps === ps.toString()) {
                    return User.updateOne({ _id }, { ps: newPs1 })
                } else {
                    return Promise.reject('原密码错误')
                }
            }
            else {
                return res.send({ err: -3, msg: '该用户不存在' });
            }
        })
        .then(() => {
            return res.send({ err: 0, msg: '密码更改成功' })
        })
        .catch((err) => { res.send({ err: -2, msg: err }) });

})



module.exports = router;