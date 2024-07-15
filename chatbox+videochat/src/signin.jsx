import React ,{useState,useEffect} from "react";
import { useNavigate } from 'react-router-dom';
import {auth} from "./firee12";
import { signInWithEmailAndPassword } from 'firebase/auth';
import "./signin.css"

const SignIn = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
      });
      const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
          ...prevState,
          [name]: value,
        }));
      };
      const handleSubmit = async (e) => {
        e.preventDefault();
        try {
          const {user} = await signInWithEmailAndPassword(auth, formData.email, formData.password);
          localStorage.setItem('userEmail', formData.email);
         navigate("/messages")
        } catch (error) {
          console.error(error);
        }
      };
    return(
        <div className="signinpage">
            <h1>Signin</h1>
            <form className="frm" onSubmit={handleSubmit}>
            <input type="email" name="email" placeholder="Email" onChange={handleChange} value={formData.email} />
            <input type="password" name="password" placeholder="Password" onChange={handleChange} value={formData.password} />
                <button type="submit">Signin</button>
            </form>
        </div>
    )
}

export default SignIn;