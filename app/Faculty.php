<?php

namespace App;

use Illuminate\Database\Eloquent\SoftDeletes;

class Faculty extends Model
{
    use SoftDeletes;

    protected $table = 'faculties';



    public function programs()
    {
        return $this->hasMany(Program::class);
    }
}
