import React ,{useState,useEffect,useRef} from "react";
import { db ,auth } from "./firee12";
import { collection, addDoc, query, orderBy, onSnapshot, where, getDocs  } from "firebase/firestore";
import { getStorage, ref, getDownloadURL ,uploadBytes } from "firebase/storage";
import { getAuth,signOut } from "firebase/auth";
import "./chat.css"
import { useNavigate } from "react-router-dom";

function Chat (){
// Yeh Saari Woh Hai Ki Jb Start Hoega Tb States Kya Hongi Kisi Constant ki 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const fileInputRef = useRef(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth); 
  const navigate = useNavigate();

  //Yeh Dekhta Hai Ki Window Ka Size kya hai
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

// yeh current user hai uski details store krta hai localstorage mei joh inspect/application/localstorage mei aata hai isse refresh pr login rehta hai
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      setCurrentUser(user);
    } else {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    }
  }, []);

  //Yeh firebase mei mesages ka ek group bna deta hai jisme userid,senderid,timestamp,aur message store hota hai 
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    const messagesRef = collection(db, "messages");
    let q = query(messagesRef, 
                  where("userId", "in", [currentUser.uid, selectedUser.id]),
                  where("senderId", "in", [currentUser.uid, selectedUser.id]),
                  orderBy("createdAt"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messages = querySnapshot.docs.map(doc => ({
        id: `${selectedUser.id}_${currentUser.uid}`,
        ...doc.data(),
      }));
      setMessages(messages.sort((a,b) => b.updatedAt - a.updatedAt));
    });

    return () => unsubscribe();
  }, [selectedUser, currentUser]);

    //Yeh Users ko fetch krta hai firebase se aur unki profile image bhi fetch krta hai

  useEffect(() => {
    const storage = getStorage();
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (querySnapshot) => {
      const usersPromises = querySnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const imgRef = ref(storage, `profileImages/${doc.id}.png`);
        const imgUrl = await getDownloadURL(imgRef).catch(() => 'defaultImageUrl');
        return {
          id: doc.id,
          ...userData,
          profileImageUrl: imgUrl,
        };
      });
      // Yeh User List ko Filter krta hai jisse Joh login Krra hai woh khud nhi show hota
      Promise.all(usersPromises).then((users) => {
        const filteredUsers = users.filter(user => user.id !== currentUser?.uid);
        setUsers(filteredUsers);
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // message send krta hai aur joh upr messages ka grp bna hai usmei jb bhi send kro toh details store ho jaati hai 
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !selectedUser || !currentUser) return;

    try {
      await addDoc(collection(db, "messages"), {
        text: newMessage,
        createdAt: new Date(),
        userId: selectedUser.id,
        senderId: currentUser.uid,
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message: ", error);
    }
  };
  // Yeh File Upload krta hai Firebase Storage Mei
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const storage = getStorage();
    const fileRef = ref(storage, `chatFiles/${currentUser.uid}_${new Date().getTime()}_${file.name}`);

    try {
      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, "messages"), {
        fileUrl,
        fileName: file.name,
        createdAt: new Date(),
        userId: selectedUser.id,
        senderId: currentUser.uid,

      });
    } catch (error) {
      console.error("Error uploading file: ", error);
    }
  };
    // Logout krta hai
    const logout = () => {
        signOut(auth);
        localStorage.removeItem('currentUser');
        navigate("/");
    }


    return(
    <div className="biglist">
  <>
    {!selectedUser && (
      <div className="userpage">
      <div className="userlist">   
      {/*Yeh User list Ko Map Krta Hai*/}
      {users.map((user) => (
        <div key={user.id} className="userlistitem" onClick={() => setSelectedUser(user)}>
          <img src={user.profileImageUrl} alt={user.username}/>
          <div className="user">
            <p className="text-lg font-semibold">{user.username}</p>
          </div>
        </div>
      ))}
      </div>
      </div>
      )}
    </>
    {selectedUser && (
        <>
        <header className="header3">
        <h3>Chat With {selectedUser.username}</h3>
        <button className="bigb" onClick={logout}>Logout</button>
      </header>
       <div className="messagediv">
        {/*Yeh Joh MEssages Hai Unko Map Krta hai */}
                {messages.map((message) => (
                  <div key={message.id} className={`${message.senderId === currentUser?.uid ? 'textright' : 'textleft'}`}>
                    <div className={`${message.senderId === currentUser?.uid ? 'bgblue' : 'bggray'} rounded-lg p-2 inline-block`}>
                      {message.text || (
                        <div style={{width:"150px"}} className="flex items-center justify-center">
                        <a href={message.fileUrl} download={message.fileName} target="_blank" rel="noopener noreferrer">
                        <img style={{width:"150px"}} src={message.fileUrl} alt="img" />
                         </a>
                        </div>
                      )}
                    </div>
                    <div className="text-xs mt-2">
                    {message.createdAt ? message.createdAt.toDate().toLocaleString() : 'Loading...'}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="themessfrm">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message"
                  className="flex p-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <button type="submit" className="bg-blue-500 rounded-full flex items-center justify-center">
                <svg width="40px" height="40px" viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.1168 12.1484C19.474 12.3581 19.9336 12.2384 20.1432 11.8811C20.3528 11.5238 20.2331 11.0643 19.8758 10.8547L19.1168 12.1484ZM6.94331 4.13656L6.55624 4.77902L6.56378 4.78344L6.94331 4.13656ZM5.92408 4.1598L5.50816 3.5357L5.50816 3.5357L5.92408 4.1598ZM5.51031 5.09156L4.76841 5.20151C4.77575 5.25101 4.78802 5.29965 4.80505 5.34671L5.51031 5.09156ZM7.12405 11.7567C7.26496 12.1462 7.69495 12.3477 8.08446 12.2068C8.47397 12.0659 8.67549 11.6359 8.53458 11.2464L7.12405 11.7567ZM19.8758 12.1484C20.2331 11.9388 20.3528 11.4793 20.1432 11.122C19.9336 10.7648 19.474 10.6451 19.1168 10.8547L19.8758 12.1484ZM6.94331 18.8666L6.56375 18.2196L6.55627 18.2241L6.94331 18.8666ZM5.92408 18.8433L5.50815 19.4674H5.50815L5.92408 18.8433ZM5.51031 17.9116L4.80505 17.6564C4.78802 17.7035 4.77575 17.7521 4.76841 17.8016L5.51031 17.9116ZM8.53458 11.7567C8.67549 11.3672 8.47397 10.9372 8.08446 10.7963C7.69495 10.6554 7.26496 10.8569 7.12405 11.2464L8.53458 11.7567ZM19.4963 12.2516C19.9105 12.2516 20.2463 11.9158 20.2463 11.5016C20.2463 11.0873 19.9105 10.7516 19.4963 10.7516V12.2516ZM7.82931 10.7516C7.4151 10.7516 7.07931 11.0873 7.07931 11.5016C7.07931 11.9158 7.4151 12.2516 7.82931 12.2516V10.7516ZM19.8758 10.8547L7.32284 3.48968L6.56378 4.78344L19.1168 12.1484L19.8758 10.8547ZM7.33035 3.49414C6.76609 3.15419 6.05633 3.17038 5.50816 3.5357L6.34 4.78391C6.40506 4.74055 6.4893 4.73863 6.55627 4.77898L7.33035 3.49414ZM5.50816 3.5357C4.95998 3.90102 4.67184 4.54987 4.76841 5.20151L6.25221 4.98161C6.24075 4.90427 6.27494 4.82727 6.34 4.78391L5.50816 3.5357ZM4.80505 5.34671L7.12405 11.7567L8.53458 11.2464L6.21558 4.83641L4.80505 5.34671ZM19.1168 10.8547L6.56378 18.2197L7.32284 19.5134L19.8758 12.1484L19.1168 10.8547ZM6.55627 18.2241C6.4893 18.2645 6.40506 18.2626 6.34 18.2192L5.50815 19.4674C6.05633 19.8327 6.76609 19.8489 7.33035 19.509L6.55627 18.2241ZM6.34 18.2192C6.27494 18.1759 6.24075 18.0988 6.25221 18.0215L4.76841 17.8016C4.67184 18.4532 4.95998 19.1021 5.50815 19.4674L6.34 18.2192ZM6.21558 18.1667L8.53458 11.7567L7.12405 11.2464L4.80505 17.6564L6.21558 18.1667ZM19.4963 10.7516H7.82931V12.2516H19.4963V10.7516Z" fill="#000000"/>
              </svg>
                </button>
                <button
                  type="button"
                  className="rounded-full flex items-center justify-center"
                  onClick={() => fileInputRef.current.click()}
                >
                  <svg width="40px" height="40px" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M26.1219 37.435C26.1219 37.435 37.4356 26.1213 40.264 23.2929C43.0924 20.4644 44.5066 13.3934 39.5569 8.44361C34.6071 3.49387 27.5361 4.90808 24.7076 7.73651C21.8792 10.5649 7.02998 25.4142 5.61576 26.8284C4.20155 28.2426 2.08023 33.1924 6.32287 37.435C10.5655 41.6776 15.5153 39.5563 16.9295 38.1421C18.3437 36.7279 33.9 21.1715 35.3142 19.7573C36.7285 18.3431 37.4356 14.8076 35.3142 12.6863C33.1929 10.5649 29.6574 11.272 28.2432 12.6863C26.829 14.1005 14.8082 26.1213 14.8082 26.1213" stroke="#000000" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </form>
        </>
      )}
    </div>
    )
}
export default Chat;