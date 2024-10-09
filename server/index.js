const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io'); 
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload')
let mongoClient = require('mongodb').MongoClient;

const app = express();
app.use(fileUpload());

app.use(function(req, res, next){
    res.header("Access-Control-Allow-Origin", "http://localhost:3000")
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})
const server = http.createServer(app);

let my_user = {} ;
let me=""

var uri = "mongodb://127.0.0.1:27017/ChatApp";
const client = new mongoClient(uri);
async function connect(){
   client.connect((err) => {
        if (err) {
            console.log(err + 'Error with connecting database');
        }
        else {
            console.log("connected successfully");
        }
    })
}




connect();

const io = socketio(server, {
    cors:{
        origin:['http://localhost:3000'],
        methods:["GET", "POST"],
        allowedHeaders:["my-custom-header"],
        credentials:true,
    } 
});



var urlencodedParser = bodyParser.urlencoded({extended:false});
var jsonParser = bodyParser.json()












 async function getData(user, res){
    const me = await client.db('ChatApp').collection('Users').findOne({userName:user});
    

          const myRoomNames = me.rooms;
          let myRooms = [];
          myRoomNames.forEach(async (room) => { 
            const myRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:room})
            if(myRoom!==null){
                myRooms.push(myRoom)
            }
          });

          const allUsers = await client.db('ChatApp').collection('Users').find({}).toArray();
         
          
          

          
          my_user=me;

        
        setTimeout(()=>{
            console.log("after 3 seconds i will send data back")
            res.status(200).json({"error":false, "rooms": myRooms, "me":me, "users": allUsers, "message":"Sign in Complete"})
            //"error":false,user:existingUser, "message":"Sign Up Complete"
        }, 3000)



       
 }










app.get('/get-data', jsonParser, async (req, res)=>{
    const {user}=req.query; 

    getData(user, res)
    
})


app.get('/get-users', jsonParser,async (req, res)=>{
    const resp = await client.db('ChatApp').collection('Users').find({}).toArray();
    res.json({"users":resp})
})

app.post('/createRoom', jsonParser, async (req, res)=>{
    console.log(req.body)
    const existingRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({
        roomName:req.body.roomName
    }); 

    console.log(existingRoom)
 
    if(existingRoom===null){
        //everytime a room is created we push it to the admins roomlist
         const updatedUser = await client.db('ChatApp').collection('Users').updateOne({
              userName:req.body.user
         }, {$push:{rooms:req.body.roomName}, $set:{currentRoom:req.body.roomName}});

         console.log(updatedUser)
     
         //Then we insert this room to globalRooms collection
            await client.db('ChatApp').collection('GlobalRooms').insertOne({
                roomName:req.body.roomName,
                avtar:"",
                category:"",
                description:"",
                members:[{username:req.body.user}],
                chats:[{username:"ChitChat", message:`Welcome ${req.body.user}`}],
                admin:req.body.user
          });
 
          //findinag all rooms of the user to send them to front enfd to get updated
          const me = await client.db('ChatApp').collection('Users').findOne({userName:req.body.user});
          const myRoomNames = me.rooms;
          let myRooms = [];
          myRoomNames.forEach(async (room) => {
            const myRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:room})
            if(myRoom!==null){
                myRooms.push(myRoom)}
          });

       
          
          setTimeout(()=>{
            res.json({"error":false, "message":"Room created successfully", "myRooms":myRooms})
          }, 3000)

    }else{
        res.json({"error":true, "message":"Room with this username already exists"})
    }

})










const problemSolver = async ()=>{
    const allUsers = await client.db('ChatApp').collection('Users').find({}).toArray();
    return allUsers
}















































io.on('connection', async (socket)=>{



    socket.on('join-room', (r)=>{
        socket.join(r)
        console.log("room = ", r)
    })


    ///////////////////////////////////////////////////////////////////
    socket.on('send-msg-to-room', async (obj)=>{
        await client.db('ChatApp').collection('GlobalRooms').updateOne({
            roomName:obj.r_name
        }, {$push:{chats:{username:obj.sender_name, message:obj.msg}}})
        socket.to(obj.r_name).emit('recieve-room-msg', {username:obj.sender_name, message:obj.msg})

    })
    ////////////////////////////////////////////////////////////////////




    // console.log("helllo its", socket.id)
    socket.emit('refetch-data', "");
     

    socket.on('get-me-new-data', async (my_dat)=>{
        const dat = await problemSolver()
        await socket.emit('take-new-data', dat)
    })


   
   
   
   
    // socket.emit('solved-your-prb')

    //i add the text messages to my chats array 
    socket.on('send-msg', async (obj)=>{
        await client.db('ChatApp').collection('Users').updateOne({
            userName:obj.myUserName, chats:{$elemMatch:{friend_name:obj.sender_name}}
        }, {$push:{"chats.$.texts":{$each:[{text_msg:obj.msg, time:"10/02/2024", status:"sender"}]}}});



    // i add my text messages to the "chats" array of friend who i am chatting with. this way our chats array will have text messages of both of us
    console.log(obj.sender_name)
        const o = await client.db('ChatApp').collection('Users').updateOne({
            userName:obj.sender_name, chats:{$elemMatch:{friend_name:obj.myUserName}}
        }, {$push:{"chats.$.texts":{$each:[{text_msg:obj.msg, time:"10/02/2024", status:"reciever"}]}}});
//  console.log(o)
        socket.to(obj.sid).emit('rec-msg', obj.msg);
    })






//////////////////////////////////////////////////////////////////////////////////////////////////

    socket.on('setup-chat-with-friend', async (obj)=>{
       
       
        //when we tap on a user from frontend we check if we have chated before or not. this query checks whether their usrname is present in our chats array or not
        const flag = await client.db('ChatApp').collection('Users').findOne({
            userName:obj.username, chats:{$elemMatch:{friend_name:obj.friend_name}}
        })


        console.log("flagggg", flag)

       //if flag variable is  equal to null that means we our frends usernam is not present in our chats array. that we are going to chat with him for the first time. therefore we add his name to our chats array
        if(flag==null){
               const r = await client.db('ChatApp').collection('Users').updateOne({
                userName:obj.username
           }, {$push:{chats:{friend_name:obj.friend_name, texts:[]}}});

        }

       
        //everytime i click on a friend , i set my currentroom to his id,
           const update_curr_room = await client.db('ChatApp').collection('Users').updateOne({
            userName:obj.username
       }, {$set:{currentRoom:obj.id}});

    // 
    })

/////////////////////////////////////////////////////////////////////////////////











    socket.on('set-socket-id', async (user_name)=>{
        my_id=socket.id
        const update_id = await client.db('ChatApp').collection('Users').updateOne({
        userName:user_name
   }, {$set:{socketId:socket.id}});
    })


    console.log("socket id setup completed")








//this event is emmited in AddUsers.js

    socket.on('make-the-room-appear', async (a)=>{
        const myy_rooms = await client.db('ChatApp').collection('GlobalRooms').find({
            members:{$elemMatch:{username:"@Nasir123"}}
        })
        
        let dat = await myy_rooms.toArray()
        console.log("this is me", dat)
        socket.emit('made-the-room-appear', dat)
    })

    
})








app.post('/save-profile-pic', (req, res)=>{
    // console.log(req.files.file.name);
     let sampleFile = req.files.file;
     let FileName = + Date.now()+sampleFile.name;
     let uploadPath = 'C:/Users/Aamir/Desktop/React Chat A pp/my-app/src/Images/Profile Pictures/' + FileName;

     sampleFile.mv(uploadPath, function(err){
         if(!err){
             res.json({"name": FileName})
         }
     })
   
 })


 
 app.post('/sign-up',jsonParser, async (req,res)=>{
    
    const {name,userName,email,phone,address,password,imageName}=req.body.userData;
    let existingUser = await client.db('ChatApp').collection('Users').findOne({
        userName: userName,
        email:email,
    });
    
    if(existingUser===null){
        let newUser = client.db("ChatApp").collection('Users').insertOne({
            name: name,
            userName: userName,
            email: email,
            phone: phone,
            address: address,
            password: password,
            imageName: imageName,
            socketId:"",
            bio:"",
            rooms:[],
            currentRoom:"",
            chats:[],
            friends:[],
            unreadMessages:{}
        })
        console.log("user added to database")
        res.status(200).json({"error":false, "message":"Sign Up Complete", "me":newUser})

    }else{
        res.json({"error":true, "message":"User with this email or username already exists"})
        console.log("didnt add user")
    }

 });





 app.post('/log-in',jsonParser, async (req, res)=>{
    const {email,password}=req.body;
    let existingUser = await client.db('ChatApp').collection('Users').findOne({
        email: email,
        password:password,
    });
    if(existingUser!==null){
        // res.status(200).json({"error":false,user:existingUser, "message":"Sign Up Complete"})
        getData(existingUser.userName, res);
    }
    else{
        res.json({"error":true, "message":"User with this email or username doesnt exist"})
    }
 })




app.post('/update-room-avtar', async (req, res)=>{
    let pfp = req.files.file;
    console.log(req.files.file)
     const FileName = Date.now()+pfp.name;
     let uploadPath = 'C:/Users/Aamir/Desktop/React Chat A pp/my-app/src/Images/Room Avtars/' + FileName;

     pfp.mv(uploadPath, function(err){
         if(!err){
             res.json({"name": FileName})
         }
     })

    //  const existingRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({
    //     roomName:req.body.roomName
    // });



    const updatedRoomAvatar = await client.db('ChatApp').collection('GlobalRooms').updateOne({
        roomName:req.query.roomName
   }, {$set:{avtar:FileName}});

})


app.post('/update-room-details', jsonParser, async (req, res)=>{
    const {user}=req.query;
    //Updating the room
  await client.db('ChatApp').collection('GlobalRooms').updateOne({
    roomName:req.query.roomName
}, {$set:{roomName:req.body.name, avtar:req.body.pfpName, category:req.body.category,description:req.body.des}});


//getting the updated room
const updatedRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({
    roomName: req.body.name
});


//updating the roomname in the rooms array of its members
await client.db('ChatApp').collection('Users').updateMany({
    rooms:req.query.roomName
}, {$set:{"rooms.$":req.body.name}});



    const me = await client.db('ChatApp').collection('Users').findOne({userName:user});
          const myRoomNames = me.rooms;
          let myRooms = [];
          myRoomNames.forEach(async (room) => {
            const myRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:room})
            if(myRoom!==null){
                myRooms.push(myRoom)
            }
          });
        
        setTimeout(()=>{
            res.json({"error":false, message:"Done", updatedRoom:updatedRoom, "rooms": myRooms, "me":me})
        }, 3000)

 
})


///add-users-to-room

app.post('/add-users-to-room', jsonParser, async (req, res)=>{
    console.log(req.body)
    let newUsers=[];
    req.body.users.forEach((item)=>{
        newUsers.push({name:item.name, username:item.userName})
    });

    let existingMems = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:req.body.room.roomName});
    console.log(existingMems)
    let allUsers = existingMems.members.concat(newUsers);
    console.log(allUsers)
    const resp = await client.db('ChatApp').collection('GlobalRooms').updateOne({
        roomName:req.body.room.roomName
    }, {$set:{members:allUsers}});
    console.log(resp)


/////////////////////////////////////////////////////////////////////////////////////////////////////////////

    req.body.users.forEach(async (item)=>{
        const resp = await client.db('ChatApp').collection('Users').updateOne({
            userName:item.userName
        }, {$push:{rooms:req.body.room.roomName}});
    });


/////////////////////////////////////////////////////////////////////////////

    if(resp.acknowledged===true){
        const updatedRooom = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:req.body.room.roomName});

        res.json({"updatedRoom":updatedRooom})
    }
    else{
        console.log("there is an error")
    }
})






















































 // utility functions 

//  const getRoomsOfaUser = async (user)=>{
//           const me = await client.db('ChatApp').collection('Users').findOne({userName:user});
//           const myRoomNames = me.rooms;
//           const i = me.rooms.length - 1;
//           let index = 0;
//           let myRooms = [];
//           myRoomNames.forEach(async (room) => {
//             const myRoom = await client.db('ChatApp').collection('GlobalRooms').findOne({roomName:room})
//             if(myRoom!==null){
//                 myRooms.push(myRoom)
//             }
//           index++;
//           });
        
//         setTimeout(()=>{
//             // console.log(myRooms)
//             return myRooms
//         }, 3000)
//  }
server.listen(5000, ()=>{
    console.log("Server running on port 3000")
})