<?php

namespace App\Http\Controllers;

use App\University;

class UniversityController extends Controller
{
    public function getUniversity(University $university)
    {
        $university->load('faculties.programs');

        return view('layouts.university', [
            'university' => $university,
        ]);
    }
}
