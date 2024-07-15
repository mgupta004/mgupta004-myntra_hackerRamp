import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, updateProfile ,sendEmailVerification } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { setDoc ,doc ,getFirestore} from 'firebase/firestore';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [username, setUsername] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const navigate = useNavigate();
    const db = getFirestore();
  
    const signUp = async (e) => {
      e.preventDefault();
      if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }
      try {
        const auth = getAuth();
        await setPersistence(auth, browserLocalPersistence);
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        const storage = getStorage();
        const profilePicRef = ref(storage, `profileImages/${user.uid}.png`);
  
        const uploadTask = uploadBytesResumable(profilePicRef, profileImage);
        uploadTask.on('state_changed', 
          (snapshot) => {
          }, 
          (error) => {
            console.error(error);
            alert('Upload failed!'); 
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
              await updateProfile(user, { displayName: username, photoURL: downloadURL })
              console.log('Profile updated:', user);
              await user.reload();
                 navigate('/login');
            }
        );
      } catch (error) {
        console.error(error);
        alert('Signup failed!');
      }

    };
    return(
      <>
      <form onSubmit={signUp}>
      <input className="w-full p-2 mb-3 border rounded" id="em" type="text" placeholder="Email" required onChange={e => setEmail(e.target.value)}></input>
            <input className="w-full p-2 mb-3 border rounded" id="us" type="text" placeholder="Name" required onChange={e => setUsername(e.target.value)}></input>
            <input className="w-full p-2 mb-3 border rounded" id="pa" type="password" placeholder="Password" required onChange={e => setPassword(e.target.value)}></input>
            <input className="w-full p-2 mb-3 border rounded" id="cpa" type="password" placeholder="Confirm Password" required onChange={e => setConfirmPassword(e.target.value)}></input>
            <input className="w-full p-2 mb-3 border rounded" id="img" type="file" placeholder="Profile Pic" onChange={e => {
            const file = e.target.files[0];
            setProfileImage(file);
            console.log(file);
            }}></input>
            <input type="submit" className="w-full p-2 text-white bg-blue-500 rounded" value="Signup"/>
          </form>
          <p>Already have an account <Link className='text-blue-500' to="/login">Login</Link></p>
      </>
    )
}
export default SignUp;